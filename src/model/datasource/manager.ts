import find from 'lodash/find';
import findIndex from 'lodash/findIndex';
import { DataSourceType, DataSource } from './interfaces';
import JaegerAPI from '../api/jaeger/api';
import ZipkinAPI from '../api/zipkin/api';
import db from '../db';
import EventEmitter from 'events';
import * as opentracing from 'opentracing';
import { OperationNamePrefix } from '../../utils/self-tracing/opname-prefix-decorator';
import { Stalk, NewTrace, ChildOf, FollowsFrom } from '../../utils/self-tracing/trace-decorator';

export enum DataSourceManagerEvent {
  ADDED = 'dsm_added',
  UPDATED = 'dsm_updated',
  REMOVED = 'dsm_removed'
}

let singletonIns: DataSourceManager;

@OperationNamePrefix('dsmanager.')
export class DataSourceManager extends EventEmitter {
  private datasources: DataSource[] = [];
  private apis: {
    [key: string]: JaegerAPI | ZipkinAPI;
  } = {};

  static getSingleton(): DataSourceManager {
    if (!singletonIns) singletonIns = new DataSourceManager();
    return singletonIns;
  }

  @Stalk({ handler: ChildOf })
  async init(ctx: opentracing.Span) {
    await db.open();
    ctx.log({ message: 'DB opened successfully' });

    const dataSources = await db.dataSources.toArray();
    ctx.log({
      message: `Got ${dataSources.length} datasource(s), adding them`
    });

    await Promise.all(dataSources.map(ds => this.add(ctx, ds, true)));
  }

  @Stalk({ handler: ChildOf })
  async add(
    ctx: opentracing.Span,
    ds: DataSource,
    doNotPersistToDatabase = false
  ) {
    const { id, type } = ds;
    let api: JaegerAPI | ZipkinAPI;

    ctx.addTags({ ...ds, doNotPersistToDatabase });

    if (find(this.datasources, ds => ds.id == id)) {
      ctx.log({ message: `There is already a datasource with id "${id}"` });
      return false;
    }

    switch (type) {
      case DataSourceType.JAEGER: {
        api = new JaegerAPI({
          baseUrl: ds.baseUrl!,
          username: ds.username,
          password: ds.password
        });
        break;
      }
      case DataSourceType.ZIPKIN: {
        api = new ZipkinAPI({
          baseUrl: ds.baseUrl!,
          username: ds.username,
          password: ds.password
        });
        break;
      }
      default: {
        throw new Error(`Unsupported data source type "${ds.type}"`);
      }
    }

    if (!doNotPersistToDatabase) await db.dataSources.put(ds);
    this.datasources.push(ds);
    this.datasources.sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
    this.apis[id] = api;
    this.emit(DataSourceManagerEvent.ADDED, ctx, ds);
    return ds;
  }

  @Stalk({ handler: ChildOf })
  async update(ctx: opentracing.Span, ds: DataSource) {
    const index = findIndex(this.datasources, x => x.id === ds.id);
    if (index === -1) return false;
    await db.dataSources.update(this.datasources[index].id, ds);
    this.datasources[index] = ds;
    this.datasources.sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
    this.emit(DataSourceManagerEvent.UPDATED, ctx, ds);
  }

  @Stalk({ handler: ChildOf })
  async remove(ctx: opentracing.Span, dsOrId: DataSource | string) {
    const index = this.getIndex(dsOrId);
    if (index === -1) return false;
    await db.dataSources.delete(this.datasources[index].id);
    const [ds] = this.datasources.splice(index, 1);
    delete this.apis[ds.id];
    this.emit(DataSourceManagerEvent.REMOVED, ctx, ds);
    return ds;
  }

  apiFor(ds: DataSource) {
    return this.apis[ds.id];
  }

  getAll() {
    return [...this.datasources];
  }

  get(dsOrId: DataSource | string) {
    const id = typeof dsOrId == 'object' && dsOrId.id ? dsOrId.id : dsOrId;
    return find(this.datasources, x => x.id === id);
  }

  getIndex(dsOrId: DataSource | string) {
    const id = typeof dsOrId == 'object' && dsOrId.id ? dsOrId.id : dsOrId;
    return findIndex(this.datasources, x => x.id === id);
  }
}
