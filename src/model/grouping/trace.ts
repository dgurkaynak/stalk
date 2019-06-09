import { Grouping } from './grouping';
import { Span } from '../span';


export class TraceGrouping extends Grouping {
    constructor() {
        super({
            key: 'trace',
            name: 'Trace',
            groupBy: (span: Span) => {
                // TODO: Get trace's root span name
                // Ama bunu yapmis olmak icin birini butun relation'lari cikarmis olmasi lazim
                // Biz bunu yavas yavas itere ederek yapamayiz.
                return [ span.traceId, `Trace ${span.traceId}` ];
            }
        });
    }


    getRootSpanOf(traceId: string) {
        const group = this.groups[traceId];
        if (!group) return;
        // There must be just one root node
        return group.get(group.rootNodes[0].spanId);
    }
}


export default TraceGrouping;
