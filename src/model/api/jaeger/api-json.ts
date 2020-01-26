import { SearchQuery, SearchResulList } from '../interfaces';
import { convertFromJaegerTrace, isJaegerJSON } from './span';
import { API } from '../interfaces';
import { Trace } from '../../../model/trace';

export class JaegerJsonAPI implements API {
  private traces: Trace[];
  private servicesAndOperationsCache: { [key: string]: string[] } = {};

  constructor(private rawData: any) {
    if (!isJaegerJSON(rawData)) {
      throw new Error('JSON is not in jaeger format');
    }

    this.traces = rawData.data.map((rawTrace: any) => {
      const spans = convertFromJaegerTrace(rawTrace);
      const trace = new Trace(spans);
      return trace;
    });
  }

  async search(query: SearchQuery): Promise<SearchResulList> {
    // NOT SUPPORTED QUERIES
    // - startTime
    // - finishTime
    // - tags
    // - minDuration
    // - maxDuration
    // - limit
    // - offset

    return {
      query,
      data: this.traces
        // Disable serviceName & operation name filtering for now, because we just want to
        // use listing all functionality.
        // .filter((trace) => {
        //     return _.some(trace.spans, (span) => {
        //         const serviceName = span.process && span.process.serviceName;
        //         if (query.serviceName && serviceName && serviceName === query.serviceName) return true;
        //         if (query.operationName && query.operationName === span.operationName) return true;
        //         return false;
        //     });
        // })
        .map(trace => trace.spans)
    };
  }

  async test() {
    // NOOP means OK
  }

  async updateServicesAndOperationsCache() {
    const servicesAndOperations: { [key: string]: string[] } = {};

    this.traces.forEach(trace => {
      trace.spans.forEach(span => {
        const serviceName = span.process && span.process.serviceName;
        if (!serviceName) return;
        if (!servicesAndOperations[serviceName])
          servicesAndOperations[serviceName] = [];
        const operationNames = servicesAndOperations[serviceName];
        if (operationNames.indexOf(span.operationName) === -1)
          operationNames.push(span.operationName);
      });
    });

    this.servicesAndOperationsCache = servicesAndOperations;
    return servicesAndOperations;
  }

  getServicesAndOperations() {
    return this.servicesAndOperationsCache;
  }
}

export default JaegerJsonAPI;
