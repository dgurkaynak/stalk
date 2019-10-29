import * as _ from 'lodash';
import EventEmitterExtra from 'event-emitter-extra';
import MPN65ColorAssigner from '../components/ui/color-assigner/mpn65';
import { Span } from './span';
import db from './db';
import TypeScriptManager from './../components/customization/typescript-manager';


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
  colorBy: (span: Span) => string
}

let singletonIns: SpanColoringManager;

export default class SpanColoringManager extends EventEmitterExtra {
  private builtInOptions: SpanColoringOptions[] = [operationColoringOptions, serviceColoringOptions];
  private customOptions: SpanColoringOptions[] = [];

  static getSingleton(): SpanColoringManager {
    if (!singletonIns) singletonIns = new SpanColoringManager();
    return singletonIns;
  }

  async init() {
    await db.open();
    const rawOptions = await db.spanColorings.toArray();
    rawOptions.forEach(raw => this.add(raw, true));
  }

  async add(raw: SpanColoringRawOptions, doNotPersistToDatabase = false) {
    const allOptions = [ ...this.builtInOptions, ...this.customOptions ];
    const keyMatch = _.find(allOptions, c => c.key === options.key);
    if (keyMatch) return false;

    const options: SpanColoringOptions = {
      key: raw.key,
      name: raw.name,
      colorBy: TypeScriptManager.generateFunction(raw.compiledCode, 'colorBy')
    };
    this.customOptions.push(options);

    if (!doNotPersistToDatabase) await db.spanColorings.put(raw);

    this.emit(SpanColoringManagerEvent.ADDED, options);
    return true;
  }

  async remove(coloringKey: string) {
    const removeds = _.remove(this.customOptions, c => c.key === coloringKey);
    if (removeds.length === 0) return false;
    await db.spanColorings.delete(coloringKey);
    this.emit(SpanColoringManagerEvent.REMOVED, removeds);
    return true;
  }

  getOptions(coloringKey: string) {
    const allOptions = [ ...this.builtInOptions, ...this.customOptions ];
    return _.find(allOptions, c => c.key === coloringKey);
  }
}

export const operationColorAssigner = new MPN65ColorAssigner();
export const operationColoringOptions: SpanColoringOptions = {
  key: 'operation',
  name: 'Operation',
  colorBy: span => operationColorAssigner.colorFor(span.operationName)
};

export const serviceColorAssigner = new MPN65ColorAssigner();
export const serviceColoringOptions: SpanColoringOptions = {
  key: 'service',
  name: 'Service',
  colorBy: (span) => {
    let serviceName = '';

    // Jaeger
    if (_.isObject(span.process) && span.process.serviceName) {
      serviceName = span.process.serviceName;
    } else if (_.isObject(span.localEndpoint) && span.localEndpoint.serviceName) { // Zipkin
      serviceName = span.localEndpoint.serviceName;
    }

    return serviceColorAssigner.colorFor(serviceName);
  }
};

