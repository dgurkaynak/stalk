import * as _ from 'lodash';
import { DataSourceType, DataSourceEntity } from './interfaces';
import JaegerAPI from './api/jaeger';
import ZipkinAPI from './api/zipkin';


type API = JaegerAPI | ZipkinAPI;


class DataSourceManager {
  private entities: DataSourceEntity[] = [];
  private apis: { [key: string]: API } = {};


  add(entity: DataSourceEntity) {
    const { id, type, baseUrl, username, password } = entity;
    let api: API;

    switch (type) {
      case DataSourceType.JAEGER: {
        api = new JaegerAPI({ baseUrl, username, password });
        break;
      }
      case DataSourceType.ZIPKIN: {
        api = new ZipkinAPI({ baseUrl, username, password });
        break;
      }
      default: {
        throw new Error(`Unsupported data source type "${entity.type}"`);
      }
    }

    this.entities.push(entity);
    this.apis[id] = api;

    return entity;
  }


  update(entity: DataSourceEntity) {
    const index = _.findIndex(this.entities, e => e.id === entity.id);
    if (index === -1) return false;
    this.entities[index] = entity;
    return entity;
  }


  remove(entity: DataSourceEntity) {
    const index = _.findIndex(this.entities, e => e.id === entity.id);
    if (index === -1) return false;
    this.entities.splice(index, 1);
    delete this.apis[entity.id];
    return entity;
  }


  apiFor(entity: DataSourceEntity) {
    return this.apis[entity.id];
  }


  getAll() {
    return [...this.entities];
  }


  get(id: string) {
    return _.find(this.entities, e => e.id === id);
  }
}


export default new DataSourceManager();
