import { BaseGrouping } from './base';
import { Span } from '../span';
import { Trace } from '../trace';


export class TraceGrouping extends BaseGrouping {
    constructor() {
        super({
            key: 'trace',
            name: 'Trace',
            groupBy: (span: Span, trace: Trace) => {
                return [ span.traceId, (trace && trace.name) || `Trace ${span.traceId}` ];
            }
        });
    }
}


export default TraceGrouping;
