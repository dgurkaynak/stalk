import * as _ from 'lodash';
import EventEmitterExtra from 'event-emitter-extra';
import { SpanGroupingOptions } from './span-grouping';
import TraceGrouping from './trace';
import ProcessGrouping from './process';
import ServiceNameGrouping from './service-name';


export enum SpanGroupingManagerEvent {
  ADDED = 'sgm_added',
  REMOVED = 'sgm_removed',
}

let singletonIns: SpanGroupingManager;

export default class SpanGroupingManager extends EventEmitterExtra {
  private builtInSpanGroupings: SpanGroupingOptions[] = [ TraceGrouping, ProcessGrouping, ServiceNameGrouping ];
  private customSpanGroupings: SpanGroupingOptions[] = [];

  static getSingleton(): SpanGroupingManager {
    if (!singletonIns) singletonIns = new SpanGroupingManager();
    return singletonIns;
  }

  async init() {
    // TODO: Fetch from database
  }

  async add(options: SpanGroupingOptions) {
    const allGroupingClasses = [ ...this.builtInSpanGroupings, ...this.customSpanGroupings ];
    const keyMatch = _.find(allGroupingClasses, c => c.key === options.key);
    if (keyMatch) return false;
    this.customSpanGroupings.push(options);
    // TODO: Add to the db
    this.emit(SpanGroupingManagerEvent.ADDED, options);
    return true;
  }

  async remove(groupingKey: string) {
    const removeds = _.remove(this.customSpanGroupings, c => c.key === groupingKey);
    if (removeds.length === 0) return false;
    // TODO: Remove from db
    this.emit(SpanGroupingManagerEvent.REMOVED, removeds);
    return true;
  }

  list() {
    const allGroupingClasses = [ ...this.builtInSpanGroupings, ...this.customSpanGroupings ];
    return allGroupingClasses.reduce((acc, c) => {
      acc[c.key] = c.name;
      return acc;
    }, {} as { [key: string]: string });
  }

  getOptions(groupingKey: string) {
    const allGroupingClasses = [ ...this.builtInSpanGroupings, ...this.customSpanGroupings ];
    return _.find(allGroupingClasses, c => c.key === groupingKey);
  }
}
