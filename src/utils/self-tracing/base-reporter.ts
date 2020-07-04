import * as opentracing from 'opentracing';
import { ISpanLog } from './span';

export class BaseReporter {
  readonly accepts = {
    spanCreate: false,
    spanLog: false,
    spanFinish: false,
  };

  recieveSpanCreate(span: opentracing.Span) {
    // Left to implementors
  }

  recieveSpanLog(span: opentracing.Span, log: ISpanLog) {
    // Left to implementors
  }

  recieveSpanFinish(span: opentracing.Span) {
    // Left to implementors
  }

  close() {
    // Left to implementors
  }
}
