import { Span } from '../interfaces';
import { Trace } from '../trace';
import { SpanGroupingOptions } from './span-grouping';

export default <SpanGroupingOptions>{
  key: 'service-name',
  name: 'Service',
  groupBy: (span: Span, trace: Trace) => {
    let serviceName = 'unknown';
    if (span.process) serviceName = span.process.serviceName;
    if (span.localEndpoint) serviceName = span.localEndpoint.serviceName;
    return [serviceName, serviceName];
  }
};
