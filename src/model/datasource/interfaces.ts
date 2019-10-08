export enum DataSourceType {
  JAEGER = 'jaeger',
  JAEGER_JSON = 'jaeger_json',
  ZIPKIN = 'zipkin',
  ZIPKIN_JSON = 'zipkin_json'
}


export interface DataSource {
  id: string;
  type: DataSourceType | string;
  name: string;
  baseUrl?: string;
  username?: string;
  password?: string;
  data?: Object|Array<any>;
}
