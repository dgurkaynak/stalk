import { Grouping } from './grouping';
import { Span } from '../span';


export class ServiceNameGrouping extends Grouping {
    constructor() {
        super({
            key: 'serviceName',
            name: 'Service',
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
