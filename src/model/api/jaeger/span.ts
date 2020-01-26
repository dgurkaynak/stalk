import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import isObject from 'lodash/isObject';
import isArray from 'lodash/isArray';
import { Span } from '../../interfaces';

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
  if (!isArray(rawTrace_.spans))
    throw new Error(`"trace.spans" must be array`);
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
