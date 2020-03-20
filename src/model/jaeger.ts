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
      query.tags = JSON.stringify(logfmt.parse(query.tags));
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
