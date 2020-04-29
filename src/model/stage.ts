import { Trace } from './trace';
import { Span, SpanLog } from './interfaces';
import EventEmitter from 'events';
import { SpanGroup } from './span-group/span-group';
import flatMap from 'lodash/flatMap';
import { union } from '../utils/interval-helper';

export enum StageEvent {
  TRACE_ADDED = 'trace_added',
  TRACE_REMOVED = 'trace_removed'
}

let _singletonIns: Stage;

export class Stage extends EventEmitter {
  private traces: { [key: string]: Trace } = {};
  private mainSpanGroup = new SpanGroup('main', '');
  private spanTags: { [key: string]: number } = {};
  private logFields: { [key: string]: number } = {};
  private processTags: { [key: string]: number } = {};
  private spanSelfTimes: { [key: string]: number } = {};

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
    if (this.traces[trace.id]) {
      return false;
    }
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

      // Process tags
      if (span.process) {
        for (let tag in span.process.tags) {
          if (!this.processTags[tag]) this.processTags[tag] = 0;
          this.processTags[tag]++;
        }
      }
    });

    // Span self time
    // We cant do this within previous loop, we need to wait until
    // all the spans are added to group, so tree relations are complete
    trace.spans.forEach(span => {
      const node = this.mainSpanGroup.nodeOf(span);
      const childrenSpans = node.children
        .filter(node => !!node.parent)
        .map(n => this.mainSpanGroup.get(n.spanId));
      const childrenTime = union(childrenSpans).reduce((acc, interval) => {
        return acc + (interval.finishTime - interval.startTime);
      }, 0);
      const selfTime = span.finishTime - span.startTime - childrenTime;
      this.spanSelfTimes[span.id] = selfTime;
    });

    this.emit(StageEvent.TRACE_ADDED, trace);
  }

  removeTrace(traceId: string) {
    if (!this.traces[traceId]) {
      return false;
    }
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

      // Process tags
      if (span.process) {
        for (let tag in span.process.tags) {
          if (!this.processTags[tag]) continue;
          this.processTags[tag]--;
          if (this.processTags[tag] <= 0) delete this.processTags[tag];
        }
      }

      // Span self time
      delete this.spanSelfTimes[span.id];
    });

    delete this.traces[traceId];
    this.emit(StageEvent.TRACE_REMOVED, trace);
  }

  isTraceAdded(traceId: string) {
    return !!this.traces[traceId];
  }

  getMainSpanGroup() {
    return this.mainSpanGroup;
  }

  getAllSpans() {
    return this.mainSpanGroup.getAll();
  }

  getAllLogs() {
    return flatMap(this.mainSpanGroup.getAll(), span => {
      return span.logs.map(log => [log, span] as [SpanLog, Span]);
    });
  }

  getAllLogFieldKeys() {
    return this.logFields;
  }

  getAllSpanTags() {
    return this.spanTags;
  }

  getAllProcessTags() {
    return this.processTags;
  }

  get startTimestamp() {
    return this.mainSpanGroup.startTimestamp;
  }

  get finishTimestamp() {
    return this.mainSpanGroup.finishTimestamp;
  }

  getSpanSelfTime(spanId: string) {
    return this.spanSelfTimes[spanId];
  }
}

export default Stage;
