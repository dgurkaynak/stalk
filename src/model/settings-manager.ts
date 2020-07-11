import db from './db';

export enum SettingsKey {
  /**
   * Do not use again. If you're going to,
   * create a new enum and do not forget to version it!
   * @deprecated
   */
  DOCK_LAYOUT = 'dock_layout',
}

export interface SettingsRecord {
  key: SettingsKey;
  value: any;
}

let singletonIns: SettingsManager;

export class SettingsManager {
  private values: { [key: string]: any } = {};

  static getSingleton(): SettingsManager {
    if (!singletonIns) singletonIns = new SettingsManager();
    return singletonIns;
  }

  async init() {
    await db.open();
    const records = await db.settings.toArray();
    records.forEach(({ key, value }) => {
      this.values[key] = value;
    });
  }

  get(key: SettingsKey) {
    return this.values[key];
  }

  async set(key: SettingsKey, value: any) {
    if (this.values.hasOwnProperty(key)) {
      await db.settings.update(key, { key, value });
    } else {
      await db.settings.put({ key, value });
    }
    this.values[key] = value;
  }
}
