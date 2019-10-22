import * as _ from 'lodash';
import EventEmitterExtra from 'event-emitter-extra';
import { BaseSpanGrouping } from './base';
import TraceGrouping from './trace';
import ProcessGrouping from './process';
import ServiceNameGrouping from './service-name';
import { Span } from '../span';
import { Trace } from '../trace';


export enum SpanGroupingManagerEvent {
  ADDED = 'sgm_added',
  REMOVED = 'sgm_removed',
}

let singletonIns: SpanGroupingManager;

export default class SpanGroupingManager extends EventEmitterExtra {
  private builtInSpanGroupings: (typeof BaseSpanGrouping)[] = [ TraceGrouping, ProcessGrouping, ServiceNameGrouping ];
  private customSpanGroupings: (typeof BaseSpanGrouping)[] = [];

  static getSingleton(): SpanGroupingManager {
    if (!singletonIns) singletonIns = new SpanGroupingManager();
    return singletonIns;
  }

  async init() {
    // TODO: Fetch from database
  }

  async add(options: {
    key: string,
    name: string,
    groupBy: (span: Span, trace: Trace) => [ string, string ]
  }) {
    const allGroupingClasses = [ ...this.builtInSpanGroupings, ...this.customSpanGroupings ];
    const keyMatch = _.find(allGroupingClasses, c => c.KEY === options.key);
    if (keyMatch) return false;
    const NewGroupingClass = class extends BaseSpanGrouping {
      static KEY = options.key;
      static NAME = options.name;
      constructor() { super({ groupBy: options.groupBy }); }
    }
    this.customSpanGroupings.push(NewGroupingClass);
    // TODO: Add to the db
    this.emit(SpanGroupingManagerEvent.ADDED, NewGroupingClass);
    return true;
  }

  async remove(groupingKey: string) {
    const removeds = _.remove(this.customSpanGroupings, c => c.KEY === groupingKey);
    if (removeds.length === 0) return false;
    // TODO: Remove from db
    this.emit(SpanGroupingManagerEvent.REMOVED, removeds);
    return true;
  }

  list() {
    const allGroupingClasses = [ ...this.builtInSpanGroupings, ...this.customSpanGroupings ];
    return allGroupingClasses.reduce((acc, c) => {
      acc[c.KEY] = c.NAME;
      return acc;
    }, {} as { [key: string]: string });
  }

  getConstructor(groupingKey: string) {
    const allGroupingClasses = [ ...this.builtInSpanGroupings, ...this.customSpanGroupings ];
    return _.find(allGroupingClasses, c => c.KEY === groupingKey);
  }
}
