import * as _ from 'lodash';
import EventEmitterExtra from 'event-emitter-extra';
import { BaseGrouping } from './base';
import TraceGrouping from './trace';
import ProcessGrouping from './trace';
import ServiceNameGrouping from './trace';
import { Span } from '../span';
import { Trace } from '../trace';


export enum GroupingManagerEvent {
  ADDED = 'gm_added',
  REMOVED = 'gm_removed',
}

let singletonIns: GroupingManager;

export default class GroupingManager extends EventEmitterExtra {
  private builtInGroupingClasses: (typeof BaseGrouping)[] = [ TraceGrouping, ProcessGrouping, ServiceNameGrouping ];
  private customGroupingClasses: (typeof BaseGrouping)[] = [];

  static getSingleton(): GroupingManager {
    if (!singletonIns) singletonIns = new GroupingManager();
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
    const allGroupingClasses = [ ...this.builtInGroupingClasses, ...this.customGroupingClasses ];
    const keyMatch = _.find(allGroupingClasses, c => c.KEY === options.key);
    if (keyMatch) return false;
    const NewGroupingClass = class extends BaseGrouping {
      static KEY = options.key;
      static NAME = options.name;
      constructor() { super({ groupBy: options.groupBy }); }
    }
    this.customGroupingClasses.push(NewGroupingClass);
    // TODO: Add to the db
    this.emit(GroupingManagerEvent.ADDED, NewGroupingClass);
    return true;
  }

  async remove(groupingKey: string) {
    const removeds = _.remove(this.customGroupingClasses, c => c.KEY === groupingKey);
    if (removeds.length === 0) return false;
    // TODO: Remove from db
    this.emit(GroupingManagerEvent.REMOVED, removeds);
    return true;
  }

  list() {
    const allGroupingClasses = [ ...this.builtInGroupingClasses, ...this.customGroupingClasses ];
    return allGroupingClasses.reduce((acc, c) => {
      acc[c.KEY] = c.NAME;
      return acc;
    }, {} as { [key: string]: string });
  }

  getGroupingClass(groupingKey: string) {
    const allGroupingClasses = [ ...this.builtInGroupingClasses, ...this.customGroupingClasses ];
    return _.find(allGroupingClasses, c => c.KEY === groupingKey);
  }
}
