import { BaseSpanGrouping } from './base';
import { Span } from '../span';


export class ServiceNameGrouping extends BaseSpanGrouping {
    static KEY = 'service_name';
    static NAME = 'Service Name';

    constructor() {
        super({
            groupBy: (span: Span) => {
                let serviceName = 'unknown';
                if (span.process) serviceName = span.process.serviceName;
                if (span.localEndpoint) serviceName = span.localEndpoint.serviceName;
                return [ serviceName, serviceName ];
            }
        });
    }
}


export default ServiceNameGrouping;
