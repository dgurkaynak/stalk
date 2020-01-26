import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import isObject from 'lodash/isObject';
import isArray from 'lodash/isArray';
import { Span } from '../../interfaces';

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
