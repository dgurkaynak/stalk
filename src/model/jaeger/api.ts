import * as _ from 'lodash';
import { SearchQuery } from '../search/interfaces';


const JAEGER_API_MAX_LIMIT = 1500;

export class JaegerAPI {
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


    async get(path: string, queryParams: { [key: string]: string } = {}) {
        const res = await this.request({ method: 'get', path, queryParams });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
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


    async getServices() {
        return this.get('/services');
    }


    async getOperations(serviceName: string) {
        return this.get(`/services/${serviceName}/operations`);
    }


    async searchTraces(options: SearchQuery) {
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
            service: options.serviceName
        };

        if (options.operationName) queryParams.operation = options.operationName;

        /**
         * Neither `start` and `end` is required, it expects microseconds.
         * There is also `lookback` param valued `1h`, but I think it's unnecessarry.
         * You can omit it.
         */
        if (options.startTime) queryParams.start = String(options.startTime * 1000);
        if (options.finishTime) queryParams.end = String(options.finishTime * 1000);

        /** Defaults to 20 */
        if (_.isNumber(options.limit)) queryParams.limit = String(options.limit);
        if (_.isNumber(options.offset)) queryParams.offset = String(options.offset);

        /**
         * It expects a human readable duration string like `100ms` or `1.2ss` or `10us`.
         * `minDuration` works, but I guess `maxDuration` is not working. When I search for
         * max `1s`, it returns traces longer than `1s`? (Update: when I search with some tags, it works)
         */
        if (_.isNumber(options.minDuration)) {
            queryParams.minDuration = `${options.minDuration}ms`;
        }
        if (_.isNumber(options.maxDuration)) {
            queryParams.maxDuration = `${options.maxDuration}ms`;
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
        if (_.isArray(options.tags) && options.tags.length > 0) {
            let tags: { [key: string]: string } = {};

            options.tags.forEach((data) => {
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

        return this.get(`/traces`, queryParams as any);
    }


    async getTrace(traceId: string) {
        // or `/traces/${traceId}`
        return this.get(`/traces`, { traceID: traceId });
    }
}


export default JaegerAPI;
