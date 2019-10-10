import * as _ from 'lodash';
import { SearchQuery, SearchResulList } from '../interfaces';
import { convertFromZipkinTrace, isZipkinJSON } from './span';
import { API } from '../interfaces';
import { Trace } from '../../../model/trace';



export class ZipkinJsonAPI implements API {
    private traces: Trace[];
    private servicesAndOperationsCache: { [key: string]: string[] } = {};


    constructor(private rawData: any) {
        if (!isZipkinJSON(rawData)) {
            throw new Error('JSON is not in zipkin format');
        }

        if (_.isArray(rawData[0])) {
            this.traces = rawData.map((rawTrace: any) => {
                const spans = convertFromZipkinTrace(rawTrace);
                const trace = new Trace(spans);
                return trace;
            });
        } else if (_.isObject(rawData[0])) {
            const spans = convertFromZipkinTrace(rawData);
            const trace = new Trace(spans);
            this.traces = [ trace ];
        } else {
            throw new Error('Unexpected zipkin json structure');
        }
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
                .filter((trace) => {
                    return _.some(trace.spans, (span) => {
                        const serviceName = span.localEndpoint && span.localEndpoint.serviceName;
                        if (query.serviceName && serviceName && serviceName === query.serviceName) return true;
                        if (query.operationName && query.operationName === span.operationName) return true;
                        return false;
                    });
                })
                .map(trace => trace.spans)
        }
    }


    async test() {
        // NOOP means OK
    }


    async updateServicesAndOperationsCache() {
        const servicesAndOperations: { [key: string]: string[] } = {};

        this.traces.forEach((trace) => {
            trace.spans.forEach((span) => {
                const serviceName = span.localEndpoint && span.localEndpoint.serviceName;
                if (!serviceName) return;
                if (!servicesAndOperations[serviceName]) servicesAndOperations[serviceName] = [];
                const operationNames = servicesAndOperations[serviceName];
                if (operationNames.indexOf(span.operationName) === -1) operationNames.push(span.operationName);
            });
        });

        this.servicesAndOperationsCache = servicesAndOperations;
        return servicesAndOperations;
    }

    getServicesAndOperations() {
        return this.servicesAndOperationsCache;
    }
}


export default ZipkinJsonAPI;
