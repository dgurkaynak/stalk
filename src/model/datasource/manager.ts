import * as _ from 'lodash';
import { DataSourceType, DataSource } from './interfaces';
import JaegerAPI from '../api/jaeger/api';
import JaegerJsonAPI from '../api/jaeger/api-json';
import ZipkinAPI from '../api/zipkin/api';
import ZipkinJsonAPI from '../api/zipkin/api-json';
import db from '../db';
import EventEmitterExtra from 'event-emitter-extra';


// Maybe seperate events like ADDED, DELETED, UPDATED?
// Not sure whether if it's gonna worth it
export enum DataSourceManagerEvent {
  UPDATED = 'dsm_updated'
}


let singletonIns: DataSourceManager;

export default class DataSourceManager extends EventEmitterExtra {
  private datasources: DataSource[] = [];
  private apis: { [key: string]: JaegerAPI | JaegerJsonAPI | ZipkinAPI | ZipkinJsonAPI } = {};


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
    let api: JaegerAPI | JaegerJsonAPI | ZipkinAPI | ZipkinJsonAPI;

    // TODO: Check id is existing

    switch (type) {
      case DataSourceType.JAEGER: {
        api = new JaegerAPI({ baseUrl: ds.baseUrl!, username: ds.username, password: ds.password });
        break;
      }
      case DataSourceType.JAEGER_JSON: {
        // TODO: Try-catch
        api = new JaegerJsonAPI(ds.data);
        break;
      }
      case DataSourceType.ZIPKIN: {
        api = new ZipkinAPI({ baseUrl: ds.baseUrl!, username: ds.username, password: ds.password });
        break;
      }
      case DataSourceType.ZIPKIN_JSON: {
        // TODO: Try-catch
        api = new ZipkinJsonAPI(ds.data);
        break;
      }
      default: {
        throw new Error(`Unsupported data source type "${ds.type}"`);
      }
    }

    if (!doNotPersistToDatabase) await db.dataSources.put(ds);
    this.datasources.push(ds);
    this.datasources.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
    this.apis[id] = api;
    this.emit(DataSourceManagerEvent.UPDATED);
    return ds;
  }


  async update(ds: DataSource) {
    const index = _.findIndex(this.datasources, x => x.id === ds.id);
    if (index === -1) return false;
    await db.dataSources.update(this.datasources[index].id, ds);
    this.datasources[index] = ds;
    this.datasources.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
    this.emit(DataSourceManagerEvent.UPDATED);
  }


  async remove(dsOrId: DataSource | string) {
    const index = this.getIndex(dsOrId);
    if (index === -1) return false;
    await db.dataSources.delete(this.datasources[index].id);
    const [ ds ] = this.datasources.splice(index, 1);
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
    return _.find(this.datasources, x => x.id === id);
  }


  getIndex(dsOrId: DataSource | string) {
    const id = typeof dsOrId == 'object' && dsOrId.id ? dsOrId.id : dsOrId;
    return _.findIndex(this.datasources, x => x.id === id);
  }
}
