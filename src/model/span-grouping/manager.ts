import find from 'lodash/find';
import remove from 'lodash/remove';
import EventEmitter from 'events';
import { SpanGroupingOptions, SpanGroupingRawOptions } from './span-grouping';
import TraceGrouping from './trace';
import ProcessGrouping from './process';
import ServiceNameGrouping from './service-name';
import db from '../db';
import { TypeScriptManager } from '../../components/customization/typescript-manager';
import { opentracing, stalk } from 'stalk-opentracing';

export enum SpanGroupingManagerEvent {
  ADDED = 'sgm_added',
  REMOVED = 'sgm_removed'
}

let singletonIns: SpanGroupingManager;

@stalk.decorators.Tag.Component('sgmanager')
export class SpanGroupingManager extends EventEmitter {
  private builtInSpanGroupings: SpanGroupingOptions[] = [
    TraceGrouping,
    ProcessGrouping,
    ServiceNameGrouping
  ];
  private customSpanGroupings: SpanGroupingOptions[] = [];

  static getSingleton(): SpanGroupingManager {
    if (!singletonIns) singletonIns = new SpanGroupingManager();
    return singletonIns;
  }

  @stalk.decorators.Trace.TraceAsync({
    operationName: 'sgmanager.init',
    relation: 'childOf'
  })
  async init(ctx: opentracing.Span) {
    await db.open();
    ctx.log({ message: 'DB opened successfully' });

    const rawOptions = await db.spanGroupings.toArray();
    ctx.log({ message: `Got ${rawOptions.length} span group(s), adding them` });

    await Promise.all(rawOptions.map(raw => this.add(ctx, raw, true)));
  }

  @stalk.decorators.Trace.TraceAsync({
    operationName: 'sgmanager.add',
    relation: 'childOf'
  })
  async add(
    ctx: opentracing.Span,
    raw: SpanGroupingRawOptions,
    doNotPersistToDatabase = false
  ) {
    const allGroupingClasses = [
      ...this.builtInSpanGroupings,
      ...this.customSpanGroupings
    ];
    ctx.addTags({ ...raw, doNotPersistToDatabase });

    const options: SpanGroupingOptions = {
      key: raw.key,
      name: raw.name,
      groupBy: TypeScriptManager.generateFunction(raw.compiledCode, 'groupBy')
    };

    const keyMatch = find(allGroupingClasses, c => c.key === options.key);
    if (keyMatch) {
      ctx.log({
        message: `There is already a span grouping with key "${options.key}"`
      });
      return false;
    }

    this.customSpanGroupings.push(options);

    if (!doNotPersistToDatabase) await db.spanGroupings.put(raw);

    this.emit(SpanGroupingManagerEvent.ADDED, options);
    return true;
  }

  async remove(groupingKey: string) {
    const removeds = remove(
      this.customSpanGroupings,
      c => c.key === groupingKey
    );
    if (removeds.length === 0) return false;
    await db.spanGroupings.delete(groupingKey);
    this.emit(SpanGroupingManagerEvent.REMOVED, removeds);
    return true;
  }

  getOptions(groupingKey: string) {
    const allGroupingClasses = [
      ...this.builtInSpanGroupings,
      ...this.customSpanGroupings
    ];
    return find(allGroupingClasses, c => c.key === groupingKey);
  }
}
