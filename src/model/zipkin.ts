import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import isObject from 'lodash/isObject';
import isArray from 'lodash/isArray';
import { Span } from './interfaces';
import urlJoin from 'url-join';

/**
 * Main documentation: https://zipkin.io/zipkin-api/#/default/get_traces
 */
export interface ZipkinAPISearchQuery {
  /**
   * According to documentation, the only required field is `serviceName`.
   * However, it can work without it. It returns all the services.
   */
  serviceName?: string;

  /**
   * Span name, or operation name.
   */
  spanName?: string;

  /**
   * Ex. `http.uri=/foo and retried` - If key/value (has an =),
   * constrains against Span.tags entres. If just a word, constrains
   * against Span.annotations[].value or Span.tags[].key. Any values are
   * AND against each other. This means a span in the trace must match
   * all of these.
   *
   * These whole string must be encoded with `encodeURIComponent()`.
   * So `http.uri=/foo and retried` should be sent as `http.uri%3D%2Ffoo%20and%20retried`.
   * However, `this.request()` handles this.
   *
   * Multiple queries should be combined with `and` keyword. If not, zipkin returns
   * no results.
   *
   * In Zipkin UI, these field displayed as `tags`.
   */
  annotationQuery?: string;

  /**
   * This field must be in ****milliseconds****. Defaults to current time.
   */
  endTs?: number;

  /**
   * This field must be in ****milliseconds****. Defaults to `endTs`.
   */
  lookback?: number;

  /**
   * These fields must be in ****microseconds****.
   */
  minDuration?: number;
  maxDuration?: number;

  /**
   * Defaults to 10. When you passed `0` or any negative number.
   * It returns an error.
   *
   * However it seems there is no upper limit. When I pass even 100000,
   * there was no error. There were 1146 traces in zipkin, I was able
   * to get it all.
   */
  limit?: number;
}

// https://zipkin.io/zipkin-api/
export class ZipkinAPI {
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

  async search(query: ZipkinAPISearchQuery) {
    const response = await this.get('/traces', query as any);
    if (!isArray(response)) {
      throw new Error('Expected zipkin response must be array');
    }
    return response.map(rawTrace => convertFromZipkinTrace(rawTrace));
  }

  async test() {
    await this.getServices();
  }

  async getServices() {
    return this.get('/services');
  }

  async getSpans(serviceName: string) {
    return this.get('/spans', { serviceName });
  }

  async getRemoteServices(serviceName: string) {
    return this.get('/remoteServices', { serviceName });
  }

  async getTrace(traceId: string) {
    const rawSpans = await this.get(`/trace/${traceId}`);
    if (!isArray(rawSpans)) {
      console.error(rawSpans);
      throw new Error(`Unexpected response from Zipkin, expected an array`);
    }

    return convertFromZipkinTrace(rawSpans);
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
