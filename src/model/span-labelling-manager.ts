import find from 'lodash/find';
import remove from 'lodash/remove';
import isObject from 'lodash/isObject';
import EventEmitterExtra from 'event-emitter-extra';
import { Span } from './interfaces';
import db from './db';
import TypeScriptManager from './../components/customization/typescript-manager';

export enum SpanLabellingManagerEvent {
  ADDED = 'slm_added',
  REMOVED = 'slm_removed'
}

export interface SpanLabellingRawOptions {
  key: string;
  name: string;
  rawCode: string;
  compiledCode: string;
}

export interface SpanLabellingOptions {
  key: string;
  name: string;
  labelBy: (span: Span) => string;
}

let singletonIns: SpanLabellingManager;

export class SpanLabellingManager extends EventEmitterExtra {
  private builtInOptions: SpanLabellingOptions[] = [
    operationLabellingOptions,
    serviceOperationLabellingOptions
  ];
  private customOptions: SpanLabellingOptions[] = [];

  static getSingleton(): SpanLabellingManager {
    if (!singletonIns) singletonIns = new SpanLabellingManager();
    return singletonIns;
  }

  async init() {
    await db.open();
    const rawOptions = await db.spanLabellings.toArray();
    rawOptions.forEach(raw => this.add(raw, true));
  }

  async add(raw: SpanLabellingRawOptions, doNotPersistToDatabase = false) {
    const allOptions = [...this.builtInOptions, ...this.customOptions];
    const keyMatch = find(allOptions, c => c.key === options.key);
    if (keyMatch) return false;

    const options: SpanLabellingOptions = {
      key: raw.key,
      name: raw.name,
      labelBy: TypeScriptManager.generateFunction(raw.compiledCode, 'labelBy')
    };
    this.customOptions.push(options);

    if (!doNotPersistToDatabase) await db.spanLabellings.put(raw);

    this.emit(SpanLabellingManagerEvent.ADDED, options);
    return true;
  }

  async remove(labellingKey: string) {
    const removeds = remove(this.customOptions, c => c.key === labellingKey);
    if (removeds.length === 0) return false;
    await db.spanLabellings.delete(labellingKey);
    this.emit(SpanLabellingManagerEvent.REMOVED, removeds);
    return true;
  }

  getOptions(labellingKey: string) {
    const allOptions = [...this.builtInOptions, ...this.customOptions];
    return find(allOptions, c => c.key === labellingKey);
  }
}

export const operationLabellingOptions: SpanLabellingOptions = {
  key: 'operation',
  name: 'Operation',
  labelBy: span => span.operationName
};

export const serviceOperationLabellingOptions: SpanLabellingOptions = {
  key: 'service-operation',
  name: 'Service + Operation',
  labelBy: span => {
    let serviceName = '';

    // Jaeger
    if (isObject(span.process) && span.process.serviceName) {
      serviceName = span.process.serviceName;
    } else if (isObject(span.localEndpoint) && span.localEndpoint.serviceName) {
      // Zipkin
      serviceName = span.localEndpoint.serviceName;
    }

    return `${serviceName}${serviceName ? '::' : ''}${span.operationName}`;
  }
};
