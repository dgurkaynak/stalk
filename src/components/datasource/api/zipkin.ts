import * as _ from 'lodash';
import { SearchQuery } from '../../search/interfaces';


// https://zipkin.apache.org/zipkin-api/#/
export class ZipkinAPI {
    private baseUrl: string;
    private headers: { [key: string]: string } = {};
    private servicesAndOperationsCache: { [key: string]: string[] } = {};


    constructor(options: {
        baseUrl: string,
        username?: string,
        password?: string
    }) {
        if (!_.isString(options.baseUrl)) {
            throw new Error(`"options.baseUrl" must be a string`);
        }

        this.baseUrl = options.baseUrl;

        // TODO: Trim ending `/` chars
        // TODO: Handle this issue generally

        if (options.username || options.password) {
            const encoded = Buffer.from(`${options.username}:${options.password}`).toString('base64');
            this.headers['Authorization'] = `Basic ${encoded}`;
        }
    }


    // `path` must be start with `/` like `/services`
    async request(options: {
        method: string,
        path: string,
        headers?: { [key: string]: string },
        queryParams?: { [key: string]: string }
    }) {
        let url = `${this.baseUrl}/zipkin/api/v2${options.path}`;
        if (_.isObject(options.queryParams) && Object.keys(options.queryParams).length > 0) {
            (url as any) = new URL(url);
            (url as any).search = new URLSearchParams(options.queryParams);
        }


        return fetch(url, {
            method: options.method,
            headers: {
                ...this.headers,
                ...(options.headers || {})
            }
        });
    }


    async get(path: string, queryParams: { [key: string]: string } = {}) {
        const res = await this.request({ method: 'get', path, queryParams });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
    }


    async updateServicesAndOperationsCache() {
        const servicesAndOperations: { [key: string]: string[] } = {};
        const services = await this.getServices();
        const tasks = services.map((service: string) => this.getSpans(service));
        const operationsArr = await Promise.all(tasks);
        services.forEach((service: string, index: number) => {
            servicesAndOperations[service] = operationsArr[index] as string[];
        });
        this.servicesAndOperationsCache = servicesAndOperations;
        return servicesAndOperations;
    }


    getServicesAndOperations() {
        return this.servicesAndOperationsCache;
    }


    async getServices() {
        return this.get('/services');
    }


    async getSpans(serviceName: string) {
        return this.get('/spans', { serviceName });
    }


    async getRemoteServices(serviceName: string) {
        return this.get('/remoteServices', { serviceName });
    }


    /**
     * https://zipkin.apache.org/zipkin-api/#/default/get_traces
     */
    async searchTraces(options: SearchQuery) {
        const queryParams: any = {};

        /**
         * `serviceName` => Ex favstar (required) - Lower-case label of a node in the service
         * graph. The /services endpoint enumerates possible input values.
         */
        if (options.serviceName) queryParams.serviceName = options.serviceName;

        /**
         * `spanName` => Ex get - name of a span in a trace. Only return traces that contains
         * spans with this name.
         */
        if (options.operationName) queryParams.spanName = options.operationName;

        /**
         * `annotationQuery` => Ex. `http.uri=/foo and retried` - If key/value (has an =),
         * constrains against Span.tags entres. If just a word, constrains
         * against Span.annotations[].value or Span.tags[].key. Any values are
         * AND against eachother. This means a span in the trace must match all of these.
         *
         * Self notes:
         * - When passed just a word (not containing `=`), api will get traces that some spans
         * contains that tag/annotation.
         * - Tag names and values are case sensitive, so `component=player` and `Component=Player` not working
         * - `and` is necessary and it's also case sensitive => `AND` is not working.
         * So, this is not working: `component=Player error=true`.
         * The valid form: `component=Player and error=true`
         */
        if (_.isArray(options.tags) && options.tags.length > 0) {
            queryParams.annotationQuery = options.tags.map((data) => {
                if (_.isString(data)) {
                    return data;
                }

                if (_.isObject(data)) {
                    const keys = Object.keys(data);
                    if (keys.length === 0) throw new Error(`Tag object must contain one key/value pair`);
                    const name = keys[0];
                    return `${name}=${data[name]}`; // TODO: Quote or not quote?
                }

                throw new Error(`Unsupported tag, it must be string or an object that contains one key/value pair`);
            }).join(' and ');
        }

        /**
         * `minDuration` => Ex. 100000 (for 100ms). Only return traces whose Span.duration is
         * greater than or equal to minDuration microseconds.
         */
        if (_.isNumber(options.minDuration)) queryParams.minDuration = String(options.minDuration * 1000);

        /**
         * `maxDuration` => Only return traces whose Span.duration is less than or equal to
         * maxDuration microseconds. Only valid with minDuration.
         */
        if (_.isNumber(options.maxDuration)) queryParams.maxDuration = String(options.maxDuration * 1000);

        /**
         * `endTs` => Only return traces where all Span.timestamp are at or before this
         * time in epoch milliseconds. Defaults to current time.
         */
        if (options.finishTime) queryParams.endTs = String(options.finishTime);

        /**
         * `lookback` => Only return traces where all Span.timestamp are at or after (endTs
         * lookback) in milliseconds. Defaults to endTs, limited to a
         * system parameter QUERY_LOOKBACK
         */
        queryParams.lookback = String(options.finishTime - options.startTime);

        /**
         * `limit` => Maximum number of traces to return. Defaults to 10
         */
        if (options.limit) queryParams.limit = String(options.limit);

        return this.get('/traces', queryParams);
    }
}


export default ZipkinAPI;
