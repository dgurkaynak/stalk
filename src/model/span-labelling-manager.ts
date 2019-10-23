import * as _ from 'lodash';
import EventEmitterExtra from 'event-emitter-extra';
import { Span } from './span';


export enum SpanLabellingManagerEvent {
  ADDED = 'slm_added',
  REMOVED = 'slm_removed',
}

export interface SpanLabellingOptions {
  key: string;
  name: string;
  labelBy: (span: Span) => string
}

let singletonIns: SpanColoringManager;

export default class SpanColoringManager extends EventEmitterExtra {
  private builtInOptions: SpanLabellingOptions[] = [operationLabellingOptions, serviceOperationLabellingOptions];
  private customOptions: SpanLabellingOptions[] = [];

  static getSingleton(): SpanColoringManager {
    if (!singletonIns) singletonIns = new SpanColoringManager();
    return singletonIns;
  }

  async init() {
    // TODO: Fetch from database
  }

  async add(options: SpanLabellingOptions) {
    const allOptions = [ ...this.builtInOptions, ...this.customOptions ];
    const keyMatch = _.find(allOptions, c => c.key === options.key);
    if (keyMatch) return false;
    this.customOptions.push(options);
    // TODO: Add to the db
    this.emit(SpanLabellingManagerEvent.ADDED, options);
    return true;
  }

  async remove(labellingKey: string) {
    const removeds = _.remove(this.customOptions, c => c.key === labellingKey);
    if (removeds.length === 0) return false;
    // TODO: Remove from db
    this.emit(SpanLabellingManagerEvent.REMOVED, removeds);
    return true;
  }

  getOptions(labellingKey: string) {
    const allOptions = [ ...this.builtInOptions, ...this.customOptions ];
    return _.find(allOptions, c => c.key === labellingKey);
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
  labelBy: (span) => {
    let serviceName = '';

    // Jaeger
    if (_.isObject(span.process) && span.process.serviceName) {
      serviceName = span.process.serviceName;
    } else if (_.isObject(span.localEndpoint) && span.localEndpoint.serviceName) { // Zipkin
      serviceName = span.localEndpoint.serviceName;
    }

    return `${serviceName}${serviceName ? '::' : ''}${span.operationName}`;
  }
};

