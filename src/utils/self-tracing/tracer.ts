import * as opentracing from 'opentracing';
import { Span } from './span';
import { SpanContext } from './span-context';
import { BaseReporter } from './base-reporter';

const generateId = () =>
  Math.random()
    .toString(16)
    .substring(2, 10) +
  Math.random()
    .toString(16)
    .substring(2, 10);

/**
 * StalkTracer inherits opentracing's noop class, with the
 * implementation of data-structure stuff and reporter interface.
 * Please note that this StalkTracer does not record any spans, hoping
 * to be garbage-collected by js engine. The job of recording and reporting
 * spans is left to reporters.
 */
export class Tracer extends opentracing.Tracer {
  /** The constant tags that will be added to all child spans */
  private _tags: { [key: string]: string } = {};

  /**
   * Reporter instances to report when a span is created.
   */
  protected _reporters: BaseReporter[] = [];
  get reporters() {
    return this._reporters;
  }

  /**
   * Updates the constant tags with Object.assign fashion.
   */
  addTags(tags: { [key: string]: string }) {
    this._tags = {
      ...this._tags,
      ...tags
    };
  }

  deleteTag(name: string) {
    delete this._tags[name];
  }

  clearTags(name: string) {
    this._tags = {};
  }

  /**
   * Adds a reporter.
   */
  addReporter(reporter: BaseReporter) {
    this._reporters.push(reporter);
  }

  /**
   * Removes a reporter.
   */
  removeReporter(reporter: BaseReporter) {
    const index = this._reporters.indexOf(reporter);
    if (index > -1) {
      const reporter = this._reporters[index];
      this._reporters.splice(index, 1);
      reporter.close();
      return true;
    }
    return false;
  }

  /**
   * Overridden just for returning span's type.
   */
  startSpan(name: string, options: opentracing.SpanOptions = {}): Span {
    return super.startSpan(name, options) as Span;
  }

  ///////////////////////////////////////////
  // Override opentracing internal methods //
  ///////////////////////////////////////////

  /**
   * Main span creating method.
   */
  protected _startSpan(name: string, fields: opentracing.SpanOptions) {
    // Extract trace id from first reference.
    // If it doesn't exists, start a new trace
    const firstRef = fields.references ? fields.references[0] : null;
    const firstRefContext = firstRef
      ? (firstRef.referencedContext() as SpanContext)
      : null;
    const traceId = firstRefContext
      ? firstRefContext.toTraceId()
      : generateId();
    const spanId = generateId();
    const spanContext = new SpanContext(traceId, spanId);
    if (firstRefContext?.baggageItems)
      spanContext.addBaggageItems(firstRefContext.baggageItems);

    const span = new Span(this, spanContext);
    span.setOperationName(name);
    span.addTags(this._tags);
    if (fields.tags) span.addTags(fields.tags);

    if (fields.references) {
      for (const ref of fields.references) {
        span.addReference(ref);
      }
    }

    span.start(fields.startTime);

    // Not cool bro
    this._reporters.forEach(reporter => {
      if (reporter.accepts.spanCreate) {
        reporter.recieveSpanCreate(span);
      }
    });

    return span;
  }

  /**
   * Not gonna use, noop
   */
  protected _inject(spanContext: SpanContext, format: string, carrier: any) {}

  /**
   * Not gonna use, noop
   */
  protected _extract(
    format: string,
    carrier: any
  ): opentracing.SpanContext | null {
    return null;
  }
}
