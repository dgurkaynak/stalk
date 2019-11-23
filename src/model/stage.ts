import { Trace } from './trace';
import EventEmitterExtra from 'event-emitter-extra';
import { SpanGroup } from './span-group/span-group';
import { Span } from './interfaces';

export enum StageEvent {
  TRACE_ADDED = 'trace_added',
  TRACE_REMOVED = 'trace_removed'
}

let _singletonIns: Stage;

export class Stage extends EventEmitterExtra {
  private traces: { [key: string]: Trace } = {};
  private mainSpanGroup = new SpanGroup('main', '');
  private spanTags: { [key: string]: number } = {};
  private logFields: { [key: string]: number } = {};

  static getSingleton() {
    if (!_singletonIns) _singletonIns = new Stage();
    (window as any).stage = _singletonIns;
    return _singletonIns;
  }

  getTrace(traceId: string) {
    return this.traces[traceId];
  }

  getAllTraces() {
    return Object.values(this.traces);
  }

  addTrace(trace: Trace) {
    if (this.traces[trace.id]) return false;
    this.traces[trace.id] = trace;

    trace.spans.forEach(span => {
      // Add to main span group
      this.mainSpanGroup.add(span);

      // Span tags
      for (let tag in span.tags) {
        if (!this.spanTags[tag]) this.spanTags[tag] = 0;
        this.spanTags[tag]++;
      }

      // Span log fields
      span.logs.forEach(log => {
        for (let field in log.fields) {
          if (!this.logFields[field]) this.logFields[field] = 0;
          this.logFields[field]++;
        }
      });
    });

    this.emit(StageEvent.TRACE_ADDED, trace);
  }

  removeTrace(traceId: string) {
    if (!this.traces[traceId]) return false;
    const trace = this.traces[traceId];

    trace.spans.forEach(span => {
      this.mainSpanGroup.remove(span);

      // Span tags
      for (let tag in span.tags) {
        if (!this.spanTags[tag]) continue;
        this.spanTags[tag]--;
        if (this.spanTags[tag] <= 0) delete this.spanTags[tag];
      }

      // Span log fields
      span.logs.forEach(log => {
        for (let field in log.fields) {
          if (!this.logFields[field]) continue;
          this.logFields[field]--;
          if (this.logFields[field] <= 0) delete this.logFields[field];
        }
      });
    });

    delete this.traces[traceId];
    this.emit(StageEvent.TRACE_REMOVED, trace);
  }

  isTraceAdded(traceId: string) {
    return !!this.traces[traceId];
  }
}

export default Stage;
