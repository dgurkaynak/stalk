import { Span } from '../span';
import { Trace } from '../trace';
import { SpanGroupingOptions } from './span-grouping';

export default <SpanGroupingOptions>{
  key: 'trace',
  name: 'Trace',
  groupBy: (span: Span, trace: Trace) => {
    return [ span.traceId, (trace && trace.name) || `Trace ${span.traceId}` ];
  }
};
