import { openDB } from 'idb';
import { ShiftRecord } from '../types';

const DB_NAME = 'cash_drawer_db';
const STORES = {
  SHIFTS: 'shifts',
  ORGANIZATION: 'organization'
} as const;
const DB_VERSION = 3;

export class DatabaseManager {
  private dbPromise;

  constructor() {
    this.dbPromise = this.initDatabase();
  }

  private async initDatabase() {
    return openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion) {
        // Create or update shifts store
        if (!db.objectStoreNames.contains(STORES.SHIFTS)) {
          const shiftStore = db.createObjectStore(STORES.SHIFTS, { keyPath: 'id' });
          shiftStore.createIndex('status', 'status');
          shiftStore.createIndex('openTime', 'openTime');
        }

        // Create or update organization store
        if (!db.objectStoreNames.contains(STORES.ORGANIZATION)) {
          db.createObjectStore(STORES.ORGANIZATION, { keyPath: 'id' });
        }
      }
    });
  }

  async saveShift(shift: ShiftRecord): Promise<void> {
    const db = await this.dbPromise;
    await db.put(STORES.SHIFTS, shift);
  }

  async getAllShifts(): Promise<ShiftRecord[]> {
    const db = await this.dbPromise;
    const shifts = await db.getAll(STORES.SHIFTS);
    return shifts.sort((a, b) => 
      new Date(b.openTime).getTime() - new Date(a.openTime).getTime()
    );
  }

  async getShiftById(id: string): Promise<ShiftRecord | undefined> {
    const db = await this.dbPromise;
    return db.get(STORES.SHIFTS, id);
  }

  async getOpenShifts(): Promise<ShiftRecord[]> {
    const db = await this.dbPromise;
    const tx = db.transaction(STORES.SHIFTS, 'readonly');
    const index = tx.store.index('status');
    return index.getAll('open');
  }

  async clearHistory(): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(STORES.SHIFTS, 'readwrite');
    const store = tx.store;
    
    const shifts = await store.getAll();
    const promises = shifts
      .filter(shift => shift.status === 'closed')
      .map(shift => store.delete(shift.id));
    
    await Promise.all(promises);
    await tx.done;
  }

  async saveOrganization(name: string): Promise<void> {
    const db = await this.dbPromise;
    await db.put(STORES.ORGANIZATION, { id: 'default', name });
  }

  async getOrganization(): Promise<string> {
    const db = await this.dbPromise;
    const org = await db.get(STORES.ORGANIZATION, 'default');
    return org?.name || '';
  }
}