import * as _ from 'lodash';


export class JaegerAPI {
    private baseUrl: string;
    private headers: { [key: string]: string } = {};


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


    async getServices() {
        return this.get('/services');
    }


    async getOperations(serviceName: string) {
        return this.get(`/services/${serviceName}/operations`);
    }


    async searchTraces(options: {
        serviceName: string,
        operationName?: string,
        startTime?: number,
        finishTime?: number,
        limit?: number,
        minDuration?: string,
        maxDuration?: string,
        tags?: { [key: string]: string }
    }) {
        const queryParams: {
            service: string,
            operation?: string,
            start?: string,
            end?: string,
            limit?: string,
            minDuration?: string,
            maxDuration?: string,
            tags?: string
        } = { service: options.serviceName };

        if (options.operationName) queryParams.operation = options.operationName;
        if (options.startTime) queryParams.start = String(options.startTime * 1000);
        if (options.finishTime) queryParams.end = String(options.finishTime * 1000);
        if (options.limit) queryParams.limit = String(options.limit);
        if (options.minDuration) queryParams.minDuration = options.minDuration;
        if (options.maxDuration) queryParams.maxDuration = options.maxDuration;
        if (_.isObject(options.tags) && !_.isEmpty(options.tags)) {
            queryParams.tags = JSON.stringify(options.tags);
        }

        return this.get(`/traces`, queryParams as any);
    }


    async getTrace(traceId: string) {
        return this.get(`/traces`, { traceID: traceId });
    }
}


export default JaegerAPI;
