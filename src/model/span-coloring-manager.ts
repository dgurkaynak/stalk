import * as _ from 'lodash';
import EventEmitterExtra from 'event-emitter-extra';
import MPN65ColorAssigner from '../components/ui/color-assigner/mpn65';
import { Span } from './span';


export enum SpanColoringManagerEvent {
  ADDED = 'scm_added',
  REMOVED = 'scm_removed',
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
    // TODO: Fetch from database
  }

  async add(options: SpanColoringOptions) {
    const allOptions = [ ...this.builtInOptions, ...this.customOptions ];
    const keyMatch = _.find(allOptions, c => c.key === options.key);
    if (keyMatch) return false;
    this.customOptions.push(options);
    // TODO: Add to the db
    this.emit(SpanColoringManagerEvent.ADDED, options);
    return true;
  }

  async remove(coloringKey: string) {
    const removeds = _.remove(this.customOptions, c => c.key === coloringKey);
    if (removeds.length === 0) return false;
    // TODO: Remove from db
    this.emit(SpanColoringManagerEvent.REMOVED, removeds);
    return true;
  }

  list() {
    const allGroupingClasses = [ ...this.builtInOptions, ...this.customOptions ];
    return allGroupingClasses.reduce((acc, c) => {
      acc[c.key] = c.name;
      return acc;
    }, {} as { [key: string]: string });
  }

  getOptions(coloringKey: string) {
    const allGroupingClasses = [ ...this.builtInOptions, ...this.customOptions ];
    return _.find(allGroupingClasses, c => c.key === coloringKey);
  }
}

export const operationColorAssigner = new MPN65ColorAssigner();
export const operationColoringOptions: SpanColoringOptions = {
  key: 'operation',
  name: 'Operation',
  colorBy: (span) => operationColorAssigner.colorFor(span.operationName)
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

