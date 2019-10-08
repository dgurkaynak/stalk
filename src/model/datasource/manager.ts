import * as _ from 'lodash';
import { DataSourceType, DataSource } from './interfaces';
import JaegerAPI from '../api/jaeger/api';
import JaegerJsonAPI from '../api/jaeger/api-json';
import ZipkinAPI from '../api/zipkin/api';
import ZipkinJsonAPI from '../api/zipkin/api-json';


let singletonIns: DataSourceManager;

class DataSourceManager {
  private datasources: DataSource[] = [];
  private apis: { [key: string]: JaegerAPI | JaegerJsonAPI | ZipkinAPI | ZipkinJsonAPI } = {};


  static getSingleton(): DataSourceManager {
    if (!singletonIns) singletonIns = new DataSourceManager();
    return singletonIns;
  }


  add(ds: DataSource) {
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

    this.datasources.push(ds);
    this.apis[id] = api;

    return ds;
  }


  update(ds: DataSource) {
    const index = _.findIndex(this.datasources, x => x.id === ds.id);
    if (index === -1) return false;
    this.datasources[index] = ds;
  }


  remove(dsOrId: DataSource | string) {
    const index = this.getIndex(dsOrId);
    if (index === -1) return false;
    const [ ds ] = this.datasources.splice(index, 1);
    delete this.apis[ds.id];
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


export default DataSourceManager;
