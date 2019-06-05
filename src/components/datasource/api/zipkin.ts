import * as _ from 'lodash';


// https://zipkin.apache.org/zipkin-api/#/
export class ZipkinAPI {
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
    async searchTraces(options: {
        serviceName?: string,
        operationName?: string,
        annotationQuery?: string,
        minDuration?: number,
        maxDuration?: number,
        finishTime?: number,
        lookback?: number,
        limit?: number
    }) {
        const queryParams: any = {};
        if (options.serviceName) queryParams.serviceName = options.serviceName;
        if (options.operationName) queryParams.spanName = options.operationName;
        if (options.annotationQuery) queryParams.annotationQuery = options.annotationQuery;
        if (options.minDuration) queryParams.minDuration = String(options.minDuration);
        if (options.maxDuration) queryParams.maxDuration = String(options.maxDuration);
        if (options.finishTime) queryParams.endTs = String(options.finishTime);
        if (options.lookback) queryParams.lookback = String(options.lookback);
        if (options.limit) queryParams.limit = String(options.limit);

        return this.get('/traces', queryParams);
    }
}


export default ZipkinAPI;
