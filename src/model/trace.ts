import isNumber from 'lodash/isNumber';
import { Span, Trace as ITrace } from './interfaces';

export class Trace implements ITrace {
  readonly spans: Span[];
  readonly startTime = Infinity;
  readonly finishTime = -Infinity;
  readonly duration: number;
  readonly rootSpan: Span | undefined;
  readonly id: string;
  readonly name: string;
  readonly spanCount: number;
  readonly spanCountsByService: { [key: string]: number } = {};
  readonly errorCount: number = 0;

  constructor(spans: Span[]) {
    this.spans = spans;
    this.spanCount = spans.length;
    let traceId = null;

    for (let span of spans) {
      this.startTime = Math.min(this.startTime, span.startTime);
      this.finishTime = Math.max(this.finishTime, span.finishTime);

      if (!traceId) {
        traceId = span.traceId;
      } else {
        if (span.traceId != traceId) {
          throw new Error(`All the spans' "traceId" must be equal`);
        }
      }

      const inTraceReferences = span.references.filter(
        (ref) => ref.traceId == span.traceId
      );
      if (inTraceReferences.length === 0) {
        this.rootSpan = span;
      }

      const serviceName = span.process
        ? span.process.serviceName
        : span.localEndpoint
        ? span.localEndpoint.serviceName
        : null;

      if (serviceName) {
        if (!isNumber(this.spanCountsByService[serviceName])) {
          this.spanCountsByService[serviceName] = 0;
        }
        this.spanCountsByService[serviceName]++;
      }

      if (span.tags.hasOwnProperty('error')) this.errorCount++;
    }

    this.duration = this.finishTime - this.startTime;
    if (this.rootSpan) {
      this.name = this.rootSpan.operationName;
      this.id = this.rootSpan.traceId;
    } else {
      this.name = '<no-root-span>';
      this.id = traceId;
    }
  }
}

export default Trace;
