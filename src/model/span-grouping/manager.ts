import * as _ from 'lodash';
import EventEmitterExtra from 'event-emitter-extra';
import { SpanGroupingOptions, SpanGroupingRawOptions } from './span-grouping';
import TraceGrouping from './trace';
import ProcessGrouping from './process';
import ServiceNameGrouping from './service-name';
import db from '../db';
import TypeScriptManager from '../../components/customization/typescript-manager';


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
    await db.open();
    const rawOptions = await db.spanGroupings.toArray();
    rawOptions.forEach(raw => this.add(raw, true));
  }

  async add(raw: SpanGroupingRawOptions, doNotPersistToDatabase = false) {
    const allGroupingClasses = [ ...this.builtInSpanGroupings, ...this.customSpanGroupings ];
    const keyMatch = _.find(allGroupingClasses, c => c.key === options.key);
    if (keyMatch) return false;

    const options: SpanGroupingOptions = {
      key: raw.key,
      name: raw.name,
      groupBy: TypeScriptManager.generateFunction(raw.compiledCode, 'groupBy')
    };
    this.customSpanGroupings.push(options);

    if (!doNotPersistToDatabase) await db.spanGroupings.put(raw);

    this.emit(SpanGroupingManagerEvent.ADDED, options);
    return true;
  }

  async remove(groupingKey: string) {
    const removeds = _.remove(this.customSpanGroupings, c => c.key === groupingKey);
    if (removeds.length === 0) return false;
    await db.spanGroupings.delete(groupingKey);
    this.emit(SpanGroupingManagerEvent.REMOVED, removeds);
    return true;
  }

  getOptions(groupingKey: string) {
    const allGroupingClasses = [ ...this.builtInSpanGroupings, ...this.customSpanGroupings ];
    return _.find(allGroupingClasses, c => c.key === groupingKey);
  }
}
