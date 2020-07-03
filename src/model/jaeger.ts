import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import isObject from 'lodash/isObject';
import isArray from 'lodash/isArray';
import { Span } from './interfaces';
import urlJoin from 'url-join';
import logfmt from 'logfmt';

export interface JaegerAPISearchQuery {
  /**
   * `service` is the only required parameter. If it's omitted, it gives the following error:
   * {"data":null,"total":0,"limit":0,"offset":0,"errors":[{"code":400,"msg":"Parameter 'service' is required"}]}
   */
  service: string;

  /**
   * Operation is optional.
   */
  operation?: string;

  /**
   * Neither `start` and `end` is required, it expects microseconds.
   * There is also `lookback` param valued `1h`, but I think it's unnecessarry.
   * You can omit it.
   */
  start?: number;
  end?: number;
  // lookback: string;

  /**
   * It expects a human readable duration string like `100ms` or `1.2ss` or `10us`.
   * `minDuration` works, but I guess `maxDuration` is not working. When I search for
   * max `1s`, it returns traces longer than `1s`? (Update: when I search with some tags, it works)
   */
  minDuration?: string;
  maxDuration?: string;

  /**
   * Tags should be in the logfmt format.
   * - Use space for conjunctions
   * - Values containing whitespace should be enclosed in quotes
   *
   * Notes to self:
   * We need to convert this string to JSON-string before sending to API, like:
   * `error` => {"error":"true"}
   * `error test` => {"error":"true","test":"true"}
   * `error=false test` => {"error":"false","test":"true"}
   */
  tags?: string;

  /**
   * Optional limit & offset.
   * When limit is omitted, API returns max 100 traces. However when it's explicitly
   * set to 0, I guess there is no limit, I've managed to get more than 1000 traces
   * with jaegertracing/all-in-one@1.17
   */
  limit?: number;
  offset?: number;
}

export class JaegerAPI {
  private baseUrl: string;
  private headers: { [key: string]: string } = {};

  constructor(options: {
    baseUrl: string;
    username?: string;
    password?: string;
  }) {
    if (!isString(options.baseUrl)) {
      throw new Error(`"options.baseUrl" must be a string`);
    }

    this.baseUrl = options.baseUrl.trim();

    if (options.username || options.password) {
      const encoded = Buffer.from(
        `${options.username}:${options.password}`
      ).toString('base64');
      this.headers['Authorization'] = `Basic ${encoded}`;
    }
  }

  async search(query: JaegerAPISearchQuery) {
    // Parse logfmt string into object, and stringify it again.
    if (isString(query.tags)) {
      // Logfmt library parses `error` or `error=true` as `{"error": true}`
      // However jaeger expects the values as string always. So, we need to convert them.
      const tags: any = logfmt.parse(query.tags);
      for (let tagKey in tags) {
        tags[tagKey] = tags[tagKey].toString();
      }

      query.tags = JSON.stringify(tags);
    }

    const response = await this.get(`/traces`, query as any);
    if (!isArray(response.data))
      throw new Error(
        `Expected jaeger response object must contain "data" array`
      );
    return response.data.map(convertFromJaegerTrace);
  }

  async test() {
    await this.getServices();
  }

  async getServices() {
    return this.get('/services');
  }

  async getOperations(serviceName: string) {
    return this.get(`/services/${serviceName}/operations`);
  }

  async getTrace(traceId: string) {
    // or `/traces/${traceId}`
    const response = await this.get(`/traces`, { traceID: traceId });
    return response.data.map(convertFromJaegerTrace);
  }

  private async get(path: string, queryParams: { [key: string]: string } = {}) {
    const res = await this.request({ method: 'get', path, queryParams });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }

  // `path` must be start with `/` like `/services`
  private async request(options: {
    method: string;
    path: string;
    headers?: { [key: string]: string };
    queryParams?: { [key: string]: string };
  }) {
    let url = urlJoin(this.baseUrl, options.path);
    if (
      isObject(options.queryParams) &&
      Object.keys(options.queryParams).length > 0
    ) {
      (url as any) = new URL(url);
      (url as any).search = new URLSearchParams(options.queryParams);
    }

    return fetch(url, {
      method: options.method,
      headers: {
        ...this.headers,
        ...(options.headers || {})
      }
    });
  }
}

export function isJaegerJSON(json: any) {
  if (!isObject(json)) return false;
  if (!isArray((json as any).data)) return false;
  if ((json as any).data.length === 0) return true;
  const firstTrace = (json as any).data[0];
  if (!isObject(firstTrace)) return false;
  return (
    isString((firstTrace as any)['traceID']) &&
    isArray((firstTrace as any)['spans'])
  );
}

export function convertFromJaegerTrace(rawTrace: any) {
  if (!isObject(rawTrace)) throw new Error(`Trace must be object`);
  const rawTrace_ = rawTrace as any;
  if (!isArray(rawTrace_.spans)) throw new Error(`"trace.spans" must be array`);
  if (!isObject(rawTrace_.processes))
    throw new Error(`"trace.processes" must be object`);

  const spans: Span[] = rawTrace_.spans.map((rawSpan: any) => {
    if (!isString(rawSpan.spanID) && rawSpan.spanID.length > 0)
      throw new Error(`"rawSpan.spanID" must be string`);
    if (!isString(rawSpan.traceID) && rawSpan.traceID.length > 0)
      throw new Error(`"rawSpan.traceID" must be string`);
    if (!isNumber(rawSpan.startTime))
      throw new Error(`"rawSpan.startTime" must be number`);
    if (!isNumber(rawSpan.duration))
      throw new Error(`"rawSpan.duration" must be number`);

    const span: Span = {
      id: rawSpan.spanID,
      traceId: rawSpan.traceID,
      operationName: rawSpan.operationName,
      startTime: rawSpan.startTime,
      finishTime: rawSpan.startTime + rawSpan.duration,
      references: [],
      tags: {},
      logs: []
    };

    if (isArray(rawSpan.references)) {
      const refTypeMapping: any = {
        CHILD_OF: 'childOf',
        FOLLOWS_FROM: 'followsFrom'
      };
      span.references = rawSpan.references.map((ref: any) => ({
        type: refTypeMapping[ref.refType],
        traceId: ref.traceID,
        spanId: ref.spanID
      }));
    }

    if (isArray(rawSpan.tags)) {
      rawSpan.tags.forEach((tag: any) => {
        span.tags[tag.key] = tag.value;
      });
    }

    if (isArray(rawSpan.logs)) {
      span.logs = rawSpan.logs.map((rawLog: any) => {
        const log = {
          timestamp: rawLog.timestamp,
          fields: {} as { [key: string]: string }
        };
        rawLog.fields.forEach(
          (field: any) => (log.fields[field.key] = field.value)
        );
        return log;
      });
    }

    if (rawSpan.processID && rawTrace_.processes[rawSpan.processID]) {
      const process = rawTrace_.processes[rawSpan.processID];
      span.process = {
        serviceName: process.serviceName,
        id: rawSpan.processID,
        tags: {}
      };
      process.tags.forEach(
        (tag: any) => (span.process!.tags[tag.key] = tag.value)
      );
    }

    return span;
  });

  return spans;
}

export function convertFromJaegerBatchThrift(batch: any) {
  if (!isObject(batch)) throw new Error(`Batch must be an object`);
  const batchAny = batch as any;
  if (!isObject(batchAny.process))
    throw new Error(`"process" must be an object`);
  if (!isString(batchAny.process.serviceName))
    throw new Error(`"process.serviceName" must be a string`);
  const process = {
    serviceName: batchAny.process.serviceName,
    id: '',
    tags: {} as { [key: string]: any }
  };

  if (isArray(batchAny.process.tags)) {
    process.tags = parseJaegerThriftTags(batchAny.process.tags);
  }

  const spans: Span[] = [];

  if (isArray(batchAny.spans)) {
    batchAny.spans.forEach((rawSpan: any) => {
      // Trace ID => Parse `traceIdLow` field.
      // Ignoring `traceIdHigh` field, its currently all zeros
      if (
        !isObject(rawSpan.traceIdLow) ||
        !isObject(rawSpan.traceIdLow.buffer)
      ) {
        console.log(rawSpan);
        throw new Error(`Unexpected "span.traceIdLow" field`);
      }
      const traceId = byteArray2number(rawSpan.traceIdLow.buffer).toString(16);

      // Span id
      if (!isObject(rawSpan.spanId) || !isObject(rawSpan.spanId.buffer)) {
        console.log(rawSpan);
        throw new Error(`Unexpected "span.spanId" field`);
      }
      const id = byteArray2number(rawSpan.spanId.buffer).toString(16);

      // Ignoring `parentSpanId` field, it is redundant.

      // Operation name
      const operationName = rawSpan.operationName;

      // References
      if (!isArray(rawSpan.references)) {
        console.log(rawSpan);
        throw new Error(
          `Unexpected "span.references" field, it must be an array`
        );
      }
      const references: any[] = [];
      rawSpan.references.map((rawRef: any) => {
        // Reference type
        if (rawRef.refType != 0 && rawRef.refType != 1) {
          console.log(rawSpan);
          throw new Error(
            `Unexpected "span.references.refType", it must be 0 or 1`
          );
        }

        // Parse `traceIdLow`
        // Ignoring `traceIdHigh` field, its currently all zeros
        if (
          !isObject(rawRef.traceIdLow) ||
          !isObject(rawRef.traceIdLow.buffer)
        ) {
          console.log(rawSpan);
          throw new Error(`Unexpected "span.references.traceIdLow" field`);
        }
        const traceId = byteArray2number(rawRef.traceIdLow.buffer).toString(16);

        // Parse span id
        if (!isObject(rawRef.spanId) || !isObject(rawRef.spanId.buffer)) {
          console.log(rawSpan);
          throw new Error(`Unexpected "span.references.spanId" field`);
        }
        const spanId = byteArray2number(rawRef.spanId.buffer).toString(16);

        // When recieving over our custom jaeger-collector-like http server
        // from jaegertracing/example-hotrod:1.17.1 app, sometimes root span has
        // a `childOf` reference, which `spanId` and `traceId` is zero. Filter those.
        if (traceId == '0' && spanId == '0') {
          return;
        }

        references.push({
          type: rawRef.refType == 0 ? 'childOf' : 'followsFrom',
          spanId,
          traceId
        });
      });

      // Start Time
      if (!isObject(rawSpan.startTime) || !isObject(rawSpan.startTime.buffer)) {
        console.log(rawSpan);
        throw new Error(`Unexpected "span.startTime" field`);
      }
      const startTime = byteArray2number(rawSpan.startTime.buffer);

      // Finish Time
      if (!isObject(rawSpan.duration) || !isObject(rawSpan.duration.buffer)) {
        console.log(rawSpan);
        throw new Error(`Unexpected "span.duration" field`);
      }
      const duration = byteArray2number(rawSpan.duration.buffer);
      const finishTime = startTime + duration;

      // Tags
      const tags = isArray(rawSpan.tags)
        ? parseJaegerThriftTags(rawSpan.tags)
        : {};

      // Logs
      const logs = !isArray(rawSpan.logs)
        ? []
        : rawSpan.logs.map((rawLog: any) => {
            if (
              !isObject(rawLog.timestamp) ||
              !isObject(rawLog.timestamp.buffer)
            ) {
              console.log(rawSpan);
              throw new Error(`Unexpected "span.logs.timestamp" field`);
            }

            return {
              timestamp: byteArray2number(rawLog.timestamp.buffer),
              fields: parseJaegerThriftTags(rawLog.fields)
            };
          });

      const span: Span = {
        id,
        traceId,
        operationName,
        startTime,
        finishTime,
        references,
        tags,
        logs,
        process
      };

      spans.push(span);
    });
  }

  return spans;
}

function parseJaegerThriftTags(
  rawTags: {
    key: string;
    vType: number; // enum TagType { STRING, DOUBLE, BOOL, LONG, BINARY }
    vStr?: string;
    vDouble?: number;
    vBool?: boolean;
    vLong?: number;
    vBinary?: any;
  }[]
) {
  const acc: { [key: string]: any } = {};

  rawTags.forEach((tagObject: any) => {
    switch (tagObject.vType) {
      case 0: // string
        acc[tagObject.key] = tagObject.vStr;
        break;
      case 1: // double
        acc[tagObject.key] = tagObject.vDouble;
        break;
      case 2: // boolean
        acc[tagObject.key] = tagObject.vBool;
        break;
      case 3: // long
        acc[tagObject.key] = byteArray2number(tagObject.vLong.buffer);
        break;
      case 4: // binary
        acc[tagObject.key] = tagObject.vBinary;
        break;
      default: {
        console.log(rawTags);
        throw new Error(
          `Unexpected jaeger thrift tag type: "${tagObject.vType}"`
        );
      }
    }
  });

  return acc;
}

export function byteArray2number(arr: number[]) {
  let num = 0;
  arr.forEach((byteNum, i) => {
    num += byteNum * Math.pow(256, arr.length - i - 1);
  });
  return num;
}
