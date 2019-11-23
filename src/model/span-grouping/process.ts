import { Span } from '../interfaces';
import { Trace } from '../trace';
import { SpanGroupingOptions } from './span-grouping';

export default <SpanGroupingOptions>{
  key: 'process',
  name: 'Process',
  groupBy: (span: Span, trace: Trace) => {
    let processId = 'unknown';
    let processName = 'unknown';

    // jaeger
    if (span.process) {
      processId = span.process.id;
      // processId is like `p1`, `p2`, `p3` and if multiple trace is added to
      // stage, it can cause to misconfigure. So you need to identify them with
      // also traceID and some-kind-of merge them if their data is matched
      processName = `${processId}:${span.process.serviceName}`;
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
  }
};
