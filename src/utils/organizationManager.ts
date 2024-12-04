import { openDB } from 'idb';

const DB_NAME = 'cash_drawer_db';
const STORE_NAME = 'organization';
const DB_VERSION = 3;

export class OrganizationManager {
  private dbPromise;

  constructor() {
    this.dbPromise = this.initDatabase();
  }

  private async initDatabase() {
    return openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      }
    });
  }

  async saveOrganization(name: string): Promise<void> {
    const db = await this.dbPromise;
    await db.put(STORE_NAME, { id: 'default', name });
  }

  async getOrganization(): Promise<string> {
    const db = await this.dbPromise;
    const org = await db.get(STORE_NAME, 'default');
    return org?.name || '';
  }
}