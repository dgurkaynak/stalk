import { Trace } from './trace';
import TraceGrouping from './grouping/trace';
import ServiceNameGrouping from './grouping/service-name';
import ProcessGrouping from './grouping/process';
import { Group } from './grouping/group';
import EventEmitterEXtra from 'event-emitter-extra';
import { Grouping } from './grouping/grouping';


export enum StageEvent {
    TRACE_ADDED = 'trace_added',
    TRACE_REMOVED = 'trace_removed'
}


let _singletonIns: Stage;

export class Stage extends EventEmitterEXtra {
    readonly group = new Group('stage', 'Stage'); // One little span group for all
    readonly grouping: { [key: string]: Grouping } = {
        trace: new TraceGrouping(),
        serviceName: new ServiceNameGrouping(),
        process: new ProcessGrouping()
    };


    static getSingleton() {
        if (!_singletonIns) _singletonIns = new Stage();
        return _singletonIns;
    }


    addTrace(trace: Trace) {
        trace.spans.forEach((span) => {
            this.group.add(span);
            this.grouping.process.addSpan(span);
            this.grouping.serviceName.addSpan(span);
            this.grouping.trace.addSpan(span, trace);
        });
        this.emit(StageEvent.TRACE_ADDED, { id: trace.id  });
    }


    removeTrace(traceId: string) {
        const traceGroup = this.grouping.trace.getGroupById(traceId);
        if (!traceGroup) return;

        traceGroup.getAll().forEach((span) => {
            this.group.remove(span);
            this.grouping.process.removeSpan(span);
            this.grouping.serviceName.removeSpan(span);
            this.grouping.trace.removeSpan(span);
        });

        this.emit(StageEvent.TRACE_REMOVED, { id: traceId  });
    }


    isTraceAdded(traceId: string) {
        return !!this.grouping.trace.getGroupById(traceId);
    }

}


export default Stage;
