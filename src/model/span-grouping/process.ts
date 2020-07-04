import { Span } from '../interfaces';
import { Trace } from '../trace';
import { SpanGroupingOptions } from './span-grouping';
import omit from 'lodash/omit';
import objectHash from 'object-hash';

export default <SpanGroupingOptions>{
  key: 'process',
  name: 'Process',
  groupBy: (span: Span, trace: Trace) => {
    let processId = 'unknown';
    let processName = 'unknown';

    // jaeger
    if (span.process) {
      // Don't care jaeger's trace specific process ids like p1, p2...
      processId = objectHash(omit(span.process, 'id'));
      processName = span.process.serviceName;
    }

    // zipkin
    if (span.localEndpoint) {
      const ipv4 = span.localEndpoint.ipv4 || '';
      const port = span.localEndpoint.port || '';
      processId = `${span.localEndpoint.serviceName}:${ipv4}:${port}`;
      processName = span.localEndpoint.serviceName;
      if (ipv4 || port) {
        processName += ` (${ipv4}:${port})`;
      }
    }

    return [processId, processName];
  },
};
