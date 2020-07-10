import find from 'lodash/find';
import remove from 'lodash/remove';
import isObject from 'lodash/isObject';
import EventEmitter from 'events';
import MPN65ColorAssigner from '../components/ui/color-assigner-mpn65';
import { Span } from './interfaces';
import db from './db';
import { TypeScriptManager } from './../components/customization/typescript-manager';
import * as chroma from 'chroma-js';
import { Stage } from './stage';

export enum SpanColoringManagerEvent {
  ADDED = 'scm_added',
  REMOVED = 'scm_removed',
}

export interface SpanColoringRawOptions {
  key: string;
  name: string;
  rawCode: string;
  compiledCode: string;
}

export interface SpanColoringOptions {
  key: string;
  name: string;
  colorBy: (span: Span) => string;
}

let singletonIns: SpanColoringManager;

export class SpanColoringManager extends EventEmitter {
  private builtInOptions: SpanColoringOptions[] = [
    operationColoringOptions,
    serviceColoringOptions,
    selfTimeColoringOptions,
  ];
  private customOptions: SpanColoringOptions[] = [];

  static getSingleton(): SpanColoringManager {
    if (!singletonIns) singletonIns = new SpanColoringManager();
    return singletonIns;
  }

  async init() {
    await db.open();
    const rawOptions = await db.spanColorings.toArray();
    await Promise.all(rawOptions.map((raw) => this.add(raw, true)));
  }

  async add(raw: SpanColoringRawOptions, doNotPersistToDatabase = false) {
    const allOptions = [...this.builtInOptions, ...this.customOptions];

    const options: SpanColoringOptions = {
      key: raw.key,
      name: raw.name,
      colorBy: TypeScriptManager.generateFunction(raw.compiledCode, 'colorBy'),
    };

    const keyMatch = find(allOptions, (c) => c.key === options.key);
    if (keyMatch) {
      return false;
    }

    this.customOptions.push(options);

    if (!doNotPersistToDatabase) await db.spanColorings.put(raw);

    this.emit(SpanColoringManagerEvent.ADDED, options);
    return true;
  }

  async remove(coloringKey: string) {
    const removeds = remove(this.customOptions, (c) => c.key === coloringKey);
    if (removeds.length === 0) return false;
    await db.spanColorings.delete(coloringKey);
    this.emit(SpanColoringManagerEvent.REMOVED, removeds);
    return true;
  }

  getOptions(coloringKey: string) {
    const allOptions = [...this.builtInOptions, ...this.customOptions];
    return find(allOptions, (c) => c.key === coloringKey);
  }
}

export const operationColorAssigner = new MPN65ColorAssigner();
export const operationColoringOptions: SpanColoringOptions = {
  key: 'operation',
  name: 'Operation',
  colorBy: (span) => operationColorAssigner.colorFor(span.operationName),
};

export const serviceColorAssigner = new MPN65ColorAssigner();
export const serviceColoringOptions: SpanColoringOptions = {
  key: 'service',
  name: 'Service',
  colorBy: (span) => {
    let serviceName = '';

    // Jaeger
    if (isObject(span.process) && span.process.serviceName) {
      serviceName = span.process.serviceName;
    } else if (isObject(span.localEndpoint) && span.localEndpoint.serviceName) {
      // Zipkin
      serviceName = span.localEndpoint.serviceName;
    }

    return serviceColorAssigner.colorFor(serviceName);
  },
};

export const selfTimeColoringScale = chroma
  .scale('RdYlBu')
  .padding([-0.15, 0.3]);
export const selfTimeColoringOptions: SpanColoringOptions = {
  key: 'selfTime',
  name: 'Self Time',
  colorBy: (span) => {
    const stage = Stage.getSingleton();
    const selfTime = stage.getSpanSelfTime(span.id);
    const selfTimeStats = stage.getSpanSelfTimeStats();

    if (!selfTime || !selfTimeStats) {
      return selfTimeColoringScale(0.5).hex();
    }

    const ratio =
      (selfTime - selfTimeStats.min) / (selfTimeStats.max - selfTimeStats.min);
    return selfTimeColoringScale(1 - ratio).hex();
  },
};
