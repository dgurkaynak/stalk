import * as _ from 'lodash';
import { SearchQuery, SearchResulList } from '../interfaces';
import { convertFromJaegerTrace } from './span';
import { API } from '../interfaces';


// const JAEGER_API_MAX_LIMIT = 1500; // UI says its 1500, but you can send request with higher

export class JaegerAPI implements API {
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


    async search(query: SearchQuery): Promise<SearchResulList> {
        const queryParams: {
            service: string,
            operation?: string,
            start?: string,
            end?: string,
            limit?: string,
            minDuration?: string,
            maxDuration?: string,
            tags?: string,
            offset?: string
        } = {
            /**
             * `service` is required.
             * Error: {"data":null,"total":0,"limit":0,"offset":0,"errors":[{"code":400,"msg":"Parameter 'service' is required"}]}
             */
            service: query.serviceName
        };

        if (query.operationName) queryParams.operation = query.operationName;

        /**
         * Neither `start` and `end` is required, it expects microseconds.
         * There is also `lookback` param valued `1h`, but I think it's unnecessarry.
         * You can omit it.
         */
        if (query.startTime) queryParams.start = String(query.startTime * 1000);
        if (query.finishTime) queryParams.end = String(query.finishTime * 1000);

        /** Defaults to 20 */
        if (_.isNumber(query.limit)) queryParams.limit = String(query.limit);
        if (_.isNumber(query.offset)) queryParams.offset = String(query.offset);

        /**
         * It expects a human readable duration string like `100ms` or `1.2ss` or `10us`.
         * `minDuration` works, but I guess `maxDuration` is not working. When I search for
         * max `1s`, it returns traces longer than `1s`? (Update: when I search with some tags, it works)
         */
        if (_.isNumber(query.minDuration)) {
            queryParams.minDuration = `${query.minDuration}ms`;
        }
        if (_.isNumber(query.maxDuration)) {
            queryParams.maxDuration = `${query.maxDuration}ms`;
        }

        /**
         * Values should be in the logfmt format.
         * - Use space for conjunctions
         * - Values containing whitespace should be enclosed in quotes
         *
         * Notes to self:
         * It expects JSON object string like:
         * `error` => {"error":"true"}
         * `error test` => {"error":"true","test":"true"}
         * `error=false test` => {"error":"false","test":"true"}
         */
        if (_.isArray(query.tags) && query.tags.length > 0) {
            let tags: { [key: string]: string } = {};

            query.tags.forEach((data) => {
                if (_.isString(data)) {
                    tags[data] = "true";
                    return;
                }

                if (_.isObject(data)) {
                    tags = {
                        ...tags,
                        ...data
                    };
                    return;
                }

                throw new Error(`Unsupported tag, it must be string or an object`);
            });

            queryParams.tags = JSON.stringify(tags);
        }

        const response = await this.get(`/traces`, queryParams as any);
        if (!_.isArray(response.data)) throw new Error(`Expected jaeger response object must contain "data" array`);
        return {
            query,
            data: response.data.map((rawTrace: any) => convertFromJaegerTrace(rawTrace))
        };
    }


    async test() {
        await this.getServices();
    }


    async updateServicesAndOperationsCache() {
        const servicesAndOperations: { [key: string]: string[] } = {};
        const { data: services } = await this.getServices();
        const tasks = services.map((service: string) => this.getOperations(service));
        const operationsArr = await Promise.all(tasks);
        services.forEach((service: string, index: number) => {
            servicesAndOperations[service] = (operationsArr[index] as any).data as string[];
        });
        this.servicesAndOperationsCache = servicesAndOperations;
        return servicesAndOperations;
    }


    getServicesAndOperations() {
        return this.servicesAndOperationsCache;
    }


    private async getServices() {
        return this.get('/services');
    }


    private async getOperations(serviceName: string) {
        return this.get(`/services/${serviceName}/operations`);
    }


    private async getTrace(traceId: string) {
        // or `/traces/${traceId}`
        return this.get(`/traces`, { traceID: traceId });
    }


    private async get(path: string, queryParams: { [key: string]: string } = {}) {
        const res = await this.request({ method: 'get', path, queryParams });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
    }


    // `path` must be start with `/` like `/services`
    private async request(options: {
        method: string,
        path: string,
        headers?: { [key: string]: string },
        queryParams?: { [key: string]: string }
    }) {
        let url = `${this.baseUrl}/api${options.path}`;
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
}


export default JaegerAPI;
