import { openDB, IDBPDatabase } from 'idb';
import { 
  ShiftRecord, 
  UserAccount, 
  ShiftLogEntry, 
  LogCategoryConfig, 
  AppSettings 
} from '../types';

const DB_NAME = 'cash_drawer_db';
const STORES = {
  SHIFTS: 'shifts',
  ORGANIZATION: 'organization',
  USERS: 'users',
  SHIFT_LOGS: 'shift_logs',
  CATEGORIES: 'log_categories',
  SETTINGS: 'app_settings',
} as const;

const DB_VERSION = 4;

export class DatabaseManager {
  private dbPromise;

  constructor() {
    this.dbPromise = this.initDatabase();
  }

  private async initDatabase() {
    const db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Shifts store
        if (!db.objectStoreNames.contains(STORES.SHIFTS)) {
          const shiftStore = db.createObjectStore(STORES.SHIFTS, { keyPath: 'id' });
          shiftStore.createIndex('status', 'status');
          shiftStore.createIndex('openTime', 'openTime');
        }

        // Organization store
        if (!db.objectStoreNames.contains(STORES.ORGANIZATION)) {
          db.createObjectStore(STORES.ORGANIZATION, { keyPath: 'id' });
        }

        // Users store
        if (!db.objectStoreNames.contains(STORES.USERS)) {
          const userStore = db.createObjectStore(STORES.USERS, { keyPath: 'id' });
          userStore.createIndex('username', 'username', { unique: true });
        }

        // Shift Logs store
        if (!db.objectStoreNames.contains(STORES.SHIFT_LOGS)) {
          const logStore = db.createObjectStore(STORES.SHIFT_LOGS, { keyPath: 'id' });
          logStore.createIndex('category', 'category');
          logStore.createIndex('shiftId', 'shiftId');
          logStore.createIndex('salesStatus', 'salesStatus');
          logStore.createIndex('hasReminder', 'hasReminder');
          logStore.createIndex('createdAt', 'createdAt');
        }

        // Categories store
        if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
          db.createObjectStore(STORES.CATEGORIES, { keyPath: 'id' });
        }

        // Settings store
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
        }
      }
    });

    // Seed defaults if first time
    await this.seedDefaults(db);
    return db;
  }

  private async seedDefaults(db: IDBPDatabase) {
    try {
      // 1. Seed Categories if empty
      const catCount = await db.count(STORES.CATEGORIES);
      if (catCount === 0) {
        const tx = db.transaction(STORES.CATEGORIES, 'readwrite');
        const defaultCategories: LogCategoryConfig[] = [
          {
            id: 'cat_sales',
            name: 'Sales',
            subcategories: ['Group', 'Wedding', 'Sports team', 'Company', 'Bus Tour', 'Family Reunion'],
            rateMultiplier: 120,
          },
          {
            id: 'cat_complaint',
            name: 'Complaint',
            subcategories: ['Room Maintenance', 'Noise / Disturbance', 'Billing & Folio', 'Housekeeping / Cleanliness', 'Staff / Service', 'Other'],
          },
          {
            id: 'cat_misc',
            name: 'Miscellaneous',
            subcategories: ['Shift Handover', 'Package Delivery', 'Lost & Found', 'Maintenance Request', 'Manager Note'],
          },
        ];
        for (const cat of defaultCategories) {
          await tx.store.put(cat);
        }
        await tx.done;
      }

      // 3. Seed Settings if empty
      const settings = await db.get(STORES.SETTINGS, 'default');
      if (!settings) {
        await db.put(STORES.SETTINGS, {
          id: 'default',
          salesRateMultiplier: 120,
          organizationName: 'Grand Hotel & Suites',
        });
      }
    } catch (err) {
      console.warn('Seeding defaults notice:', err);
    }
  }

  /* -------------------------------------------------------------
   *  Shifts Operations
   * ------------------------------------------------------------- */
  async saveShift(shift: ShiftRecord): Promise<void> {
    const db = await this.dbPromise;
    await db.put(STORES.SHIFTS, shift);
  }

  async bulkSaveShifts(shifts: ShiftRecord[]): Promise<void> {
    if (!shifts || shifts.length === 0) return;
    const db = await this.dbPromise;
    const tx = db.transaction(STORES.SHIFTS, 'readwrite');
    for (const shift of shifts) {
      await tx.store.put(shift);
    }
    await tx.done;
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
    try {
      const currentSettings = await this.getSettings();
      await this.saveSettings({ ...currentSettings, organizationName: name });
    } catch {
      // ignore
    }
  }

  async saveOrganizationName(name: string): Promise<void> {
    return this.saveOrganization(name);
  }

  async getOrganization(): Promise<string> {
    const db = await this.dbPromise;
    const org = await db.get(STORES.ORGANIZATION, 'default');
    return org?.name || '';
  }

  /* -------------------------------------------------------------
   *  User Accounts (Managers & Clerks)
   * ------------------------------------------------------------- */
  async hasUsers(): Promise<boolean> {
    const db = await this.dbPromise;
    const count = await db.count(STORES.USERS);
    return count > 0;
  }

  async getUsers(): Promise<UserAccount[]> {
    const db = await this.dbPromise;
    const users = await db.getAll(STORES.USERS);
    return users.sort((a, b) => a.username.localeCompare(b.username));
  }

  async getUserByUsername(username: string): Promise<UserAccount | undefined> {
    const db = await this.dbPromise;
    const clean = username.trim().toLowerCase();
    const tx = db.transaction(STORES.USERS, 'readonly');
    const index = tx.store.index('username');
    const user = await index.get(clean);
    if (user) return user;

    // Friendly alias fallback: if user typed "clerk", check "clerk1"; if "clerk1", check "clerk"
    if (clean === 'clerk') {
      const aliasUser = await index.get('clerk1');
      if (aliasUser) return aliasUser;
    } else if (clean === 'clerk1') {
      const aliasUser = await index.get('clerk');
      if (aliasUser) return aliasUser;
    }

    return undefined;
  }

  async saveUser(user: UserAccount): Promise<void> {
    const db = await this.dbPromise;
    const cleanUsername = user.username.trim().toLowerCase();

    // Check if user with this username already exists so the unique index constraint is respected
    const existing = await this.getUserByUsername(cleanUsername);
    const idToUse = existing ? existing.id : (user.id || `usr_${Date.now()}`);

    await db.put(STORES.USERS, {
      ...user,
      id: idToUse,
      username: cleanUsername,
    });
  }

  async deleteUser(userId: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(STORES.USERS, userId);
  }

  async bulkSaveUsers(users: UserAccount[]): Promise<void> {
    if (!users || users.length === 0) return;
    const db = await this.dbPromise;
    const tx = db.transaction(STORES.USERS, 'readwrite');
    for (const u of users) {
      await tx.store.put(u);
    }
    await tx.done;
  }

  /* -------------------------------------------------------------
   *  Shift Logs & Leads Operations
   * ------------------------------------------------------------- */
  async getShiftLogs(): Promise<ShiftLogEntry[]> {
    const db = await this.dbPromise;
    const logs = await db.getAll(STORES.SHIFT_LOGS);
    return logs.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getAllShiftLogs(): Promise<ShiftLogEntry[]> {
    return this.getShiftLogs();
  }

  async getShiftLogsByShiftId(shiftId: string): Promise<ShiftLogEntry[]> {
    const db = await this.dbPromise;
    const tx = db.transaction(STORES.SHIFT_LOGS, 'readonly');
    const index = tx.store.index('shiftId');
    return index.getAll(shiftId);
  }

  async saveShiftLog(log: ShiftLogEntry): Promise<void> {
    const db = await this.dbPromise;
    await db.put(STORES.SHIFT_LOGS, log);
  }

  async deleteShiftLog(logId: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(STORES.SHIFT_LOGS, logId);
  }

  async bulkSaveShiftLogs(logs: ShiftLogEntry[]): Promise<void> {
    if (!logs || logs.length === 0) return;
    const db = await this.dbPromise;
    const tx = db.transaction(STORES.SHIFT_LOGS, 'readwrite');
    for (const log of logs) {
      await tx.store.put(log);
    }
    await tx.done;
  }

  /* -------------------------------------------------------------
   *  Categories Operations
   * ------------------------------------------------------------- */
  async getCategories(): Promise<LogCategoryConfig[]> {
    const db = await this.dbPromise;
    return db.getAll(STORES.CATEGORIES);
  }

  async saveCategory(cat: LogCategoryConfig): Promise<void> {
    const db = await this.dbPromise;
    await db.put(STORES.CATEGORIES, cat);
  }

  async deleteCategory(catId: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(STORES.CATEGORIES, catId);
  }

  async bulkSaveCategories(cats: LogCategoryConfig[]): Promise<void> {
    if (!cats || cats.length === 0) return;
    const db = await this.dbPromise;
    const tx = db.transaction(STORES.CATEGORIES, 'readwrite');
    for (const c of cats) {
      await tx.store.put(c);
    }
    await tx.done;
  }

  /* -------------------------------------------------------------
   *  App Settings Operations
   * ------------------------------------------------------------- */
  async getSettings(): Promise<AppSettings> {
    const db = await this.dbPromise;
    const s = await db.get(STORES.SETTINGS, 'default');
    return s || {
      id: 'default',
      salesRateMultiplier: 120,
      organizationName: 'Grand Hotel & Suites',
    };
  }

  async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    const db = await this.dbPromise;
    const current = await this.getSettings();
    await db.put(STORES.SETTINGS, {
      ...current,
      ...settings,
      id: 'default',
    });
  }

  /* -------------------------------------------------------------
   *  Database Inspector & Backup Operations
   * ------------------------------------------------------------- */
  async getStoreCounts(): Promise<Record<string, number>> {
    const db = await this.dbPromise;
    const counts: Record<string, number> = {};
    for (const storeName of Object.values(STORES)) {
      if (db.objectStoreNames.contains(storeName)) {
        counts[storeName] = await db.count(storeName);
      }
    }
    return counts;
  }

  async getStoreRecords(storeName: string): Promise<Record<string, unknown>[]> {
    const db = await this.dbPromise;
    type StoreKey = (typeof STORES)[keyof typeof STORES];
    const validStore = Object.values(STORES).find((s) => s === storeName) as StoreKey | undefined;
    if (!validStore || !db.objectStoreNames.contains(validStore)) return [];
    return db.getAll(validStore) as unknown as Promise<Record<string, unknown>[]>;
  }

  async exportFullDatabaseDump(): Promise<{
    databaseName: string;
    version: number;
    exportedAt: string;
    stores: {
      shifts: ShiftRecord[];
      users: UserAccount[];
      shift_logs: ShiftLogEntry[];
      log_categories: LogCategoryConfig[];
      app_settings: AppSettings;
    };
  }> {
    const [shifts, users, shift_logs, log_categories, app_settings] = await Promise.all([
      this.getAllShifts(),
      this.getUsers(),
      this.getShiftLogs(),
      this.getCategories(),
      this.getSettings(),
    ]);

    return {
      databaseName: DB_NAME,
      version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      stores: {
        shifts,
        users,
        shift_logs,
        log_categories,
        app_settings,
      },
    };
  }

  async resetDatabaseToFactoryDefaults(): Promise<void> {
    const db = await this.dbPromise;
    const storeNames = [
      STORES.SHIFTS,
      STORES.SHIFT_LOGS,
      STORES.ORGANIZATION,
      STORES.USERS,
      STORES.CATEGORIES,
      STORES.SETTINGS,
    ];
    const tx = db.transaction(storeNames, 'readwrite');
    for (const name of storeNames) {
      if (db.objectStoreNames.contains(name)) {
        await tx.objectStore(name).clear();
      }
    }
    await tx.done;

    // Reseed default categories
    const defaultCategories: LogCategoryConfig[] = [
      {
        id: 'cat_sales',
        name: 'Sales',
        subcategories: ['Group', 'Wedding', 'Sports team', 'Company', 'Bus Tour', 'Family Reunion'],
        rateMultiplier: 120,
      },
      {
        id: 'cat_complaint',
        name: 'Complaint',
        subcategories: ['Room Maintenance', 'Noise / Disturbance', 'Billing & Folio', 'Housekeeping / Cleanliness', 'Staff / Service', 'Other'],
      },
      {
        id: 'cat_misc',
        name: 'Miscellaneous',
        subcategories: ['Shift Handover', 'Package Delivery', 'Lost & Found', 'Maintenance Request', 'Manager Note'],
      },
    ];
    await this.bulkSaveCategories(defaultCategories);

    // Reseed default settings
    await this.saveSettings({
      id: 'default',
      salesRateMultiplier: 120,
      organizationName: 'Grand Hotel & Suites',
    });
  }
}
