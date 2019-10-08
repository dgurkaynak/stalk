import * as _ from 'lodash';
import { Span } from '../../span';


export function isZipkinJSON(json: any) {
    if (!_.isArray(json)) return false;
    const firstTraceSpans = json[0] as any[];
    if (!_.isArray(firstTraceSpans)) return false;
    const firstSpan = firstTraceSpans[0] as any;
    if (!_.isObject(firstSpan)) return false;
    return _.isString((firstSpan as any)['traceId']) && _.isString((firstSpan as any)['id']);
}


export function convertFromZipkinTrace(rawTrace: any) {
    if (!_.isArray(rawTrace)) throw new Error(`Trace must be array`);

    const spans: Span[] = rawTrace.map((rawSpan: any) => {
        if (!_.isString(rawSpan.id) && rawSpan.id.length > 0) throw new Error(`"rawSpan.id" must be string`);
        if (!_.isString(rawSpan.traceId) && rawSpan.traceId.length > 0) throw new Error(`"rawSpan.traceId" must be string`);
        if (!_.isNumber(rawSpan.timestamp)) throw new Error(`"rawSpan.timestamp" must be number`);
        if (!_.isNumber(rawSpan.duration)) rawSpan.duration = 0;

        const span: Span = {
            id: rawSpan.id,
            traceId: rawSpan.traceId,
            operationName: rawSpan.name,
            startTime: rawSpan.timestamp,
            finishTime: rawSpan.timestamp + rawSpan.duration,
            references: [],
            tags: _.isObject(rawSpan.tags) ? rawSpan.tags : {},
            logs: [],
            localEndpoint: _.isObject(rawSpan.localEndpoint) ? rawSpan.localEndpoint : { serviceName: 'unknown' }
        };

        if (_.isString(rawSpan.parentId) && rawSpan.parentId.length > 0) {
            span.references.push({
                type: 'childOf',
                traceId: rawSpan.traceId,
                spanId: rawSpan.parentId
            });
        }

        if (_.isArray(rawSpan.annotations)) {
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
