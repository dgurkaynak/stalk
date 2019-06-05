export enum DataSourceType {
  JAEGER = 'jaeger',
  ZIPKIN = 'zipkin'
}


export interface DataSourceEntity {
  id: string;
  type: DataSourceType | string;
  name: string;
  baseUrl: string;
  username?: string;
  password?: string;
}
