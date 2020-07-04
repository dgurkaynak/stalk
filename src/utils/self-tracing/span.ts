import * as opentracing from 'opentracing';
import { Tracer } from './tracer';
import { SpanContext } from './span-context';

export interface ISpanLog {
  fields: { [key: string]: any };
  timestamp?: number;
}

/**
 * StalkSpan inherits opentracing's noop span, with the implementation
 * of following functionalities:
 *  - Keeping data (operation name, start & finish time, tags and logs)
 *  - Keeping references of referenced-spans
 *  - Keeping reference of tracer and context
 */
export class Span extends opentracing.Span {
  private _operationName: string;
  private _startTime: number;
  private _finishTime: number;
  private _references: opentracing.Reference[] = [];
  private _tags: { [key: string]: any } = {};
  private _logs: ISpanLog[] = [];

  private __tracer: Tracer;
  private __context: SpanContext;

  constructor(tracer: Tracer, context: SpanContext) {
    super();
    this.__tracer = tracer;
    this.__context = context;
  }

  /**
   * Override just for returning tracer's type
   */
  tracer(): Tracer {
    return super.tracer() as Tracer;
  }

  /**
   * Sets the start time of span. Defaults to `Date.now()`.
   */
  start(startTime?: number) {
    this._startTime = startTime || Date.now();
  }

  /**
   * Adds a reference to another span.
   */
  addReference(ref: opentracing.Reference) {
    this._references.push(ref);
  }

  /**
   * Gets specified tag.
   */
  getTag(key: string) {
    return this._tags[key];
  }

  /**
   * Play well with JSON.stringify()
   */
  toJSON() {
    return {
      context: this.__context,
      operationName: this._operationName,
      startTime: this._startTime,
      finishTime: this._finishTime,
      references: this._references.map((r) => ({
        type: r.type(),
        referencedContext: r.referencedContext(), // TODO: If referenced context is not stalk-span-context?
      })),
      tags: this._tags,
      logs: this._logs,
    };
  }

  static fromJSON(raw: any) {
    const spanContext = new SpanContext(
      raw.context.traceId,
      raw.context.spanId
    );
    spanContext.addBaggageItems(raw.context.baggageItems || {});

    // TODO: Is it OK to pass null as tracer?
    const span = new Span(null, spanContext);
    span._operationName = raw.operationName;
    span._startTime = raw.startTime;
    span._finishTime = raw.finishTime;

    if (raw.references?.length > 0) {
      span._references = raw.references.map((ref: any) => {
        const refCtx = new SpanContext(
          ref.referencedContext.traceId,
          ref.referencedContext.spanId
        );
        refCtx.addBaggageItems(ref.referencedContext.baggageItems || {});
        return new opentracing.Reference(ref.type, refCtx);
      });
    }

    span._tags = raw.tags || {};
    span._logs = raw.logs || [];

    return span;
  }

  ///////////////////////////////////////////
  // Override opentracing internal methods //
  ///////////////////////////////////////////

  /**
   * Returns the span context.
   */
  protected _context() {
    return this.__context;
  }

  /**
   * Returns the tracer.
   */
  protected _tracer() {
    return this.__tracer;
  }

  /**
   * Sets the operation name of span.
   */
  protected _setOperationName(name: string) {
    this._operationName = name;
  }

  /**
   * Add tags to the span.
   * Will be merged into current tags with object assigning.
   */
  protected _addTags(keyValuePairs: { [key: string]: any }) {
    this._tags = {
      ...this._tags,
      ...keyValuePairs, // TODO: Cast to string
    };
  }

  /**
   * Adds a log.
   */
  protected _log(keyValuePairs: { [key: string]: any }, timestamp?: number) {
    const log = {
      fields: keyValuePairs, // TODO: Cast to string
      timestamp: timestamp || Date.now(),
    };
    this._logs.push(log);

    // Not cool bro
    this.__tracer.reporters.forEach((reporter) => {
      if (reporter.accepts.spanLog) {
        reporter.recieveSpanLog(this, log);
      }
    });
  }

  /**
   * Finishes span. Defaults to `Date.now()`.
   */
  protected _finish(finishTime?: number) {
    this._finishTime = finishTime || Date.now();

    // Not cool bro
    this.__tracer.reporters.forEach((reporter) => {
      if (reporter.accepts.spanFinish) {
        reporter.recieveSpanFinish(this);
      }
    });
  }

  /**
   * Sets a baggage item.
   */
  protected _setBaggageItem(key: string, value: string): void {
    this.__context.addBaggageItems({ [key]: value });
  }

  /**
   * Gets a baggage item
   */
  protected _getBaggageItem(key: string): string | undefined {
    return this.__context.baggageItems[key];
  }
}
