import Dexie from 'dexie';
import { DataSource } from './datasource/interfaces';

export class AppDatabase extends Dexie {
    dataSources: Dexie.Table<DataSource, string>;

    constructor () {
        super('AppDatabase');
        this.version(1).stores({
            dataSources: 'id'
        });

        this.dataSources = this.table('dataSources');
    }
}

const singleton = new AppDatabase();
export default singleton;
