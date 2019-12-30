import { Span } from '../interfaces';
import { Trace } from '../trace';
import { SpanGroupingOptions } from './span-grouping';

export default <SpanGroupingOptions>{
  key: 'service-name',
  name: 'Service',
  groupBy: (span: Span, trace: Trace) => {
    let serviceName = serviceNameOf(span) || 'unknown';
    return [serviceName, serviceName];
  }
};

export function serviceNameOf(span: Span) {
  let serviceName: string;
  if (span.process) serviceName = span.process.serviceName;
  if (span.localEndpoint) serviceName = span.localEndpoint.serviceName;
  return serviceName;
}
