import { Trace } from './trace';
import EventEmitterExtra from 'event-emitter-extra';

export enum StageEvent {
  TRACE_ADDED = 'trace_added',
  TRACE_REMOVED = 'trace_removed'
}

let _singletonIns: Stage;

export class Stage extends EventEmitterExtra {
  private _traces: { [key: string]: Trace } = {};

  static getSingleton() {
    if (!_singletonIns) _singletonIns = new Stage();
    return _singletonIns;
  }

  getTrace(traceId: string) {
    return this._traces[traceId];
  }

  getAllTraces() {
    return Object.values(this._traces);
  }

  addTrace(trace: Trace) {
    if (this._traces[trace.id]) return false;
    this._traces[trace.id] = trace;
    this.emit(StageEvent.TRACE_ADDED, trace);
  }

  removeTrace(traceId: string) {
    if (!this._traces[traceId]) return false;
    const trace = this._traces[traceId];
    delete this._traces[traceId];
    this.emit(StageEvent.TRACE_REMOVED, trace);
  }

  isTraceAdded(traceId: string) {
    return !!this._traces[traceId];
  }
}

export default Stage;
