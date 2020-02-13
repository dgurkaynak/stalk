import * as opentracing from 'opentracing';

export class SpanContext extends opentracing.SpanContext {
  private _traceId: string;
  private _spanId: string;
  private _baggageItems: { [key: string]: string } = {};

  constructor(traceId: string, spanId: string) {
    super();

    this._traceId = traceId;
    this._spanId = spanId;
  }

  toTraceId() {
    return this._traceId;
  }

  toSpanId() {
    return this._spanId;
  }

  toJSON() {
    return {
      traceId: this._traceId,
      spanId: this._spanId,
      baggageItems: this._baggageItems
    };
  }

  addBaggageItems(items: { [key: string]: string }) {
    this._baggageItems = {
      ...this._baggageItems,
      ...items
    };
  }

  get baggageItems() {
    return this._baggageItems;
  }
}
