import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import isObject from 'lodash/isObject';
import isArray from 'lodash/isArray';
import { Span } from './interfaces';
import urlJoin from 'url-join';

// const ZIPKIN_API_MAX_LIMIT = 250;

export interface ZipkinAPISearchQuery {
  serviceName: string;
  operationName?: string;
  startTime: number;
  finishTime: number;
  tags: (string | { [key: string]: string })[];
  minDuration?: number;
  maxDuration?: number;
  limit: number;
  offset?: number;
}

// https://zipkin.apache.org/zipkin-api/#/
export class ZipkinAPI {
  private baseUrl: string;
  private headers: { [key: string]: string } = {};
  private servicesAndOperationsCache: { [key: string]: string[] } = {};

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

  /**
   * https://zipkin.apache.org/zipkin-api/#/default/get_traces
   */
  async search(query: ZipkinAPISearchQuery) {
    const queryParams: any = {};

    /**
     * `serviceName` => Ex favstar (required) - Lower-case label of a node in the service
     * graph. The /services endpoint enumerates possible input values.
     */
    if (query.serviceName) queryParams.serviceName = query.serviceName;

    /**
     * `spanName` => Ex get - name of a span in a trace. Only return traces that contains
     * spans with this name.
     */
    if (query.operationName) queryParams.spanName = query.operationName;

    /**
     * `annotationQuery` => Ex. `http.uri=/foo and retried` - If key/value (has an =),
     * constrains against Span.tags entres. If just a word, constrains
     * against Span.annotations[].value or Span.tags[].key. Any values are
     * AND against eachother. This means a span in the trace must match all of these.
     *
     * Self notes:
     * - When passed just a word (not containing `=`), api will get traces that some spans
     * contains that tag/annotation.
     * - Tag names and values are case sensitive, so `component=player` and `Component=Player` not working
     * - `and` is necessary and it's also case sensitive => `AND` is not working.
     * So, this is not working: `component=Player error=true`.
     * The valid form: `component=Player and error=true`
     */
    if (isArray(query.tags) && query.tags.length > 0) {
      queryParams.annotationQuery = query.tags
        .map(data => {
          if (isString(data)) {
            return data;
          }

          if (isObject(data)) {
            const keys = Object.keys(data);
            if (keys.length === 0)
              throw new Error(`Tag object must contain one key/value pair`);
            const name = keys[0];
            return `${name}=${data[name]}`; // TODO: Quote or not quote?
          }

          throw new Error(
            `Unsupported tag, it must be string or an object that contains one key/value pair`
          );
        })
        .join(' and ');
    }

    /**
     * `minDuration` => Ex. 100000 (for 100ms). Only return traces whose Span.duration is
     * greater than or equal to minDuration microseconds.
     */
    if (isNumber(query.minDuration))
      queryParams.minDuration = String(query.minDuration * 1000);

    /**
     * `maxDuration` => Only return traces whose Span.duration is less than or equal to
     * maxDuration microseconds. Only valid with minDuration.
     */
    if (isNumber(query.maxDuration))
      queryParams.maxDuration = String(query.maxDuration * 1000);

    /**
     * `endTs` => Only return traces where all Span.timestamp are at or before this
     * time in epoch milliseconds. Defaults to current time.
     */
    if (query.finishTime) queryParams.endTs = String(query.finishTime);

    /**
     * `lookback` => Only return traces where all Span.timestamp are at or after (endTs
     * lookback) in milliseconds. Defaults to endTs, limited to a
     * system parameter QUERY_LOOKBACK
     */
    queryParams.lookback = String(query.finishTime - query.startTime);

    /**
     * `limit` => Maximum number of traces to return. Defaults to 10
     */
    if (query.limit) queryParams.limit = String(query.limit);

    const response = await this.get('/traces', queryParams);
    if (!isArray(response))
      throw new Error('Expected zipkin response must be array');
    return {
      query,
      data: response.map(rawTrace => convertFromZipkinTrace(rawTrace))
    };
  }

  async test() {
    await this.getServices();
  }

  async updateServicesAndOperationsCache() {
    const servicesAndOperations: { [key: string]: string[] } = {};
    const services = await this.getServices();
    const tasks = services.map((service: string) => this.getSpans(service));
    const operationsArr = await Promise.all(tasks);
    services.forEach((service: string, index: number) => {
      servicesAndOperations[service] = operationsArr[index] as string[];
    });
    this.servicesAndOperationsCache = servicesAndOperations;
    return servicesAndOperations;
  }

  getServicesAndOperations() {
    return this.servicesAndOperationsCache;
  }

  private async getServices() {
    return this.get('/services');
  }

  private async getSpans(serviceName: string) {
    return this.get('/spans', { serviceName });
  }

  private async getRemoteServices(serviceName: string) {
    return this.get('/remoteServices', { serviceName });
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
    let url = urlJoin(this.baseUrl, `zipkin/api/v2${options.path}`);
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

export function isZipkinJSON(json: any) {
  if (!isArray(json)) return false;
  const firstTraceSpans = json[0] as any[];

  if (isArray(firstTraceSpans)) {
    const firstSpan = firstTraceSpans[0] as any;
    if (!isObject(firstSpan)) return false;
    return (
      isString((firstSpan as any)['traceId']) &&
      isString((firstSpan as any)['id'])
    );
  } else if (isObject(firstTraceSpans)) {
    const firstSpan = firstTraceSpans;
    return (
      isString((firstSpan as any)['traceId']) &&
      isString((firstSpan as any)['id'])
    );
  }

  return false;
}

export function convertFromZipkinTrace(rawTrace: any) {
  if (!isArray(rawTrace)) throw new Error(`Trace must be array`);

  const spans: Span[] = rawTrace.map((rawSpan: any) => {
    if (!isString(rawSpan.id) && rawSpan.id.length > 0)
      throw new Error(`"rawSpan.id" must be string`);
    if (!isString(rawSpan.traceId) && rawSpan.traceId.length > 0)
      throw new Error(`"rawSpan.traceId" must be string`);
    if (!isNumber(rawSpan.timestamp))
      throw new Error(`"rawSpan.timestamp" must be number`);
    if (!isNumber(rawSpan.duration)) rawSpan.duration = 0;

    const span: Span = {
      id: rawSpan.id,
      traceId: rawSpan.traceId,
      operationName: rawSpan.name,
      startTime: rawSpan.timestamp,
      finishTime: rawSpan.timestamp + rawSpan.duration,
      references: [],
      tags: isObject(rawSpan.tags) ? rawSpan.tags : {},
      logs: [],
      localEndpoint: isObject(rawSpan.localEndpoint)
        ? rawSpan.localEndpoint
        : { serviceName: 'unknown' }
    };

    if (isString(rawSpan.parentId) && rawSpan.parentId.length > 0) {
      span.references.push({
        type: 'childOf',
        traceId: rawSpan.traceId,
        spanId: rawSpan.parentId
      });
    }

    if (isArray(rawSpan.annotations)) {
      span.logs = rawSpan.annotations.map((anno: any) => ({
        timestamp: anno.timestamp,
        fields: {
          annotation: anno.value
        }
      }));
    }

    return span;
  });

  return spans;
}
