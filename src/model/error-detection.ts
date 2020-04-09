/**
 * Zipkin:
 * - https://github.com/openzipkin/zipkin-api/blob/master/thrift/zipkinCore.thrift
 * - span has `error` tag, and its value is whatever
 * - span has `http.status_code` tag, and its value >= 500
 *    - this kind of error is not explicity indicated with red
 * - any annotation value contains `error` keyword (not tag)
 *    - this is indicated with yellow mark (https://github.com/openzipkin/zipkin/issues/2138#issuecomment-405787230)
 *
 * Jaeger:
 * - https://github.com/opentracing/specification/blob/master/semantic_conventions.md
 * - span has `error` tag, and its value is `true`
 * - `http.status_code` tag >= 500
 *    - jaeger does nothing special with these spans
 * - log has `event` field, and its value is `error`
 * - log has `error` field, and its value is whatever (in hotrod demo)
 * - log has `level` field, and its value is `error` (in hotrod demo)
 */

import { Span } from './interfaces';

export function checkSpan(span: Span) {
  return span.tags.hasOwnProperty('error');
}

export function checkTag(key: string, value: any) {
  if (key == 'error') return true;
  return false;
}

export function checkLogField(key: string, value: any) {
  if (key == 'error') return true;
  if (key == 'event' && value == 'error') return true;
  if (key == 'level' && value == 'error') return true;
  return false;
}
