import Dexie from 'dexie';
import { DataSource } from './datasource/interfaces';
import { SpanGroupingRawOptions } from '../model/span-grouping/span-grouping';
import { SpanLabellingRawOptions } from '../model/span-labelling-manager';
import { SpanColoringRawOptions } from '../model/span-coloring-manager';

export class AppDatabase extends Dexie {
  dataSources: Dexie.Table<DataSource, string>;
  spanGroupings: Dexie.Table<SpanGroupingRawOptions, string>;
  spanLabellings: Dexie.Table<SpanLabellingRawOptions, string>;
  spanColorings: Dexie.Table<SpanColoringRawOptions, string>;

  constructor() {
    super('AppDatabase');
    this.version(1).stores({
      dataSources: 'id'
    });
    this.version(2).stores({
      spanGroupings: 'key',
      spanLabellings: 'key',
      spanColorings: 'key'
    });

    this.dataSources = this.table('dataSources');
    this.spanGroupings = this.table('spanGroupings');
    this.spanLabellings = this.table('spanLabellings');
    this.spanColorings = this.table('spanColorings');
  }
}

const singleton = new AppDatabase();
export default singleton;
