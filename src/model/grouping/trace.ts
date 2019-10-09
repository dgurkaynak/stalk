import { Grouping } from './grouping';
import { Span } from '../span';
import { Trace } from '../trace';


export class TraceGrouping extends Grouping {
    constructor() {
        super({
            key: 'trace',
            name: 'Trace',
            groupBy: (span: Span, trace?: Trace) => {
                return [ span.traceId, (trace && trace.name) || `Trace ${span.traceId}` ];
            }
        });
    }
}


export default TraceGrouping;
