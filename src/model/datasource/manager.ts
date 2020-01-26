import find from 'lodash/find';
import findIndex from 'lodash/findIndex';
import { DataSourceType, DataSource } from './interfaces';
import JaegerAPI from '../api/jaeger/api';
import ZipkinAPI from '../api/zipkin/api';
import db from '../db';
import EventEmitter from 'events';

// Maybe seperate events like ADDED, DELETED, UPDATED?
// Not sure whether if it's gonna worth it
export enum DataSourceManagerEvent {
  UPDATED = 'dsm_updated'
}

let singletonIns: DataSourceManager;

export class DataSourceManager extends EventEmitter {
  private datasources: DataSource[] = [];
  private apis: {
    [key: string]: JaegerAPI | ZipkinAPI;
  } = {};

  static getSingleton(): DataSourceManager {
    if (!singletonIns) singletonIns = new DataSourceManager();
    return singletonIns;
  }

  async init() {
    await db.open();

    const dataSources = await db.dataSources.toArray();
    dataSources.forEach(ds => this.add(ds, true));
  }

  async add(ds: DataSource, doNotPersistToDatabase = false) {
    const { id, type } = ds;
    let api: JaegerAPI | ZipkinAPI;

    // TODO: Check id is existing

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
    this.emit(DataSourceManagerEvent.UPDATED);
    return ds;
  }

  async update(ds: DataSource) {
    const index = findIndex(this.datasources, x => x.id === ds.id);
    if (index === -1) return false;
    await db.dataSources.update(this.datasources[index].id, ds);
    this.datasources[index] = ds;
    this.datasources.sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
    this.emit(DataSourceManagerEvent.UPDATED);
  }

  async remove(dsOrId: DataSource | string) {
    const index = this.getIndex(dsOrId);
    if (index === -1) return false;
    await db.dataSources.delete(this.datasources[index].id);
    const [ds] = this.datasources.splice(index, 1);
    delete this.apis[ds.id];
    this.emit(DataSourceManagerEvent.UPDATED);
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
