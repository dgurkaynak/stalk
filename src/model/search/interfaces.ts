import { DataSource } from "../datasource/interfaces";


export interface SearchQuery {
  dataSource?: DataSource,
  serviceName: string,
  operationName?: string,
  startTime: number,
  finishTime: number,
  tags: (string | { [key: string]: string })[],
  minDuration?: number,
  maxDuration?: number,
  limit: number
}
