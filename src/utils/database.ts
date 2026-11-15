import { openDB, IDBPDatabase } from 'idb';
import { 
  ShiftRecord, 
  UserAccount, 
  ShiftLogEntry, 
  LogCategoryConfig, 
  AppSettings,
  DatabaseArchive
} from '../types';

const DB_NAME = 'cash_drawer_db';
const ARCHIVE_STORAGE_KEY = 'cdm_database_archives';
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

  async deleteShift(id: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(STORES.SHIFTS, id);
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
    try {
      const user = await db.getFromIndex(STORES.USERS, 'username', clean);
      if (user) return user;
    } catch {
      // index query failed, fall through to memory scan
    }

    // Direct scan across all stored users to be 100% resilient
    const users = await db.getAll(STORES.USERS);
    const directUser = users.find((u) => u.username.trim().toLowerCase() === clean);
    if (directUser) return directUser;

    // Friendly alias fallback: if user typed "clerk", check "clerk1"; if "clerk1", check "clerk"
    if (clean === 'clerk') {
      return users.find((u) => u.username.trim().toLowerCase() === 'clerk1');
    } else if (clean === 'clerk1') {
      return users.find((u) => u.username.trim().toLowerCase() === 'clerk');
    }

    return undefined;
  }

  async saveUser(user: UserAccount): Promise<void> {
    const db = await this.dbPromise;
    const cleanUsername = user.username.trim().toLowerCase();

    // Check if user with this username already exists so the unique index constraint is respected
    const all = await db.getAll(STORES.USERS);
    const existing = all.find((u) => u.username.trim().toLowerCase() === cleanUsername);
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
    const all = await db.getAll(STORES.USERS);
    const existingByUsername = new Map<string, UserAccount>();
    all.forEach((u) => existingByUsername.set(u.username.trim().toLowerCase(), u));

    for (const u of users) {
      if (!u || !u.username) continue;
      const clean = u.username.trim().toLowerCase();
      const existing = existingByUsername.get(clean);
      const idToUse = existing ? existing.id : (u.id || `usr_${Date.now()}`);
      await db.put(STORES.USERS, {
        ...u,
        id: idToUse,
        username: clean,
      });
      existingByUsername.set(clean, { ...u, id: idToUse, username: clean });
    }
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
    if (s) {
      return {
        ...s,
        maxOpenDrawers: typeof s.maxOpenDrawers === 'number' && s.maxOpenDrawers > 0 ? s.maxOpenDrawers : 1,
        databaseEpoch: typeof s.databaseEpoch === 'number' ? s.databaseEpoch : 0,
        databaseId: s.databaseId || 'default',
      };
    }
    return {
      id: 'default',
      salesRateMultiplier: 120,
      organizationName: 'Grand Hotel & Suites',
      maxOpenDrawers: 1,
      databaseEpoch: 0,
      databaseId: 'default',
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
      databaseEpoch: 0,
      databaseId: 'purged',
    });
  }

  /* -------------------------------------------------------------
   *  Database Archiving & Restoration
   * ------------------------------------------------------------- */
  getDatabaseArchives(): DatabaseArchive[] {
    try {
      const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  saveDatabaseArchive(archive: DatabaseArchive): void {
    try {
      const existing = this.getDatabaseArchives();
      const updated = [archive, ...existing.filter((a) => a.id !== archive.id)];
      localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save database archive:', e);
    }
  }

  deleteDatabaseArchivePermanently(archiveId: string): void {
    try {
      const existing = this.getDatabaseArchives();
      const updated = existing.filter((a) => a.id !== archiveId);
      localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to delete database archive:', e);
    }
  }

  async createDatabaseArchive(archivedBy: string, syncGroupName?: string): Promise<DatabaseArchive> {
    const [shifts, users, shiftLogs, categories, settings, organization] = await Promise.all([
      this.getAllShifts(),
      this.getUsers(),
      this.getShiftLogs(),
      this.getCategories(),
      this.getSettings(),
      this.getOrganization(),
    ]);

    const hotelName = organization?.name || settings?.organizationName || 'Grand Hotel & Suites';
    const groupName = syncGroupName || hotelName;

    const archive: DatabaseArchive = {
      id: `arch_${Date.now()}`,
      hotelName,
      syncGroup: groupName,
      archivedAt: new Date().toISOString(),
      archivedBy: archivedBy || 'Manager',
      shifts,
      shiftLogs,
      categories,
      users,
      settings,
      organization: organization || { id: 'default', name: hotelName },
      summary: {
        shiftsCount: shifts.length,
        logsCount: shiftLogs.length,
        usersCount: users.length,
        categoriesCount: categories.length,
      },
    };

    this.saveDatabaseArchive(archive);
    return archive;
  }

  async restoreDatabaseFromArchive(archiveId: string): Promise<DatabaseArchive> {
    const archives = this.getDatabaseArchives();
    const archive = archives.find((a) => a.id === archiveId);
    if (!archive) {
      throw new Error(`Archive with ID ${archiveId} not found.`);
    }

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

    if (archive.shifts && archive.shifts.length > 0) {
      await this.bulkSaveShifts(archive.shifts);
    }
    if (archive.shiftLogs && archive.shiftLogs.length > 0) {
      await this.bulkSaveShiftLogs(archive.shiftLogs);
    }
    if (archive.categories && archive.categories.length > 0) {
      await this.bulkSaveCategories(archive.categories);
    }
    if (archive.users && archive.users.length > 0) {
      await this.bulkSaveUsers(archive.users);
    }
    const restoreEpoch = Date.now();
    const restoredSettings: AppSettings = {
      ...(archive.settings || {}),
      id: 'default',
      salesRateMultiplier: archive.settings?.salesRateMultiplier || 120,
      organizationName: archive.hotelName || archive.settings?.organizationName || 'Grand Hotel & Suites',
      databaseEpoch: restoreEpoch,
      databaseId: `db_restore_${restoreEpoch}_${Math.random().toString(36).substring(2, 7)}`,
      isRestoredArchive: true,
    };
    await this.saveSettings(restoredSettings);
    if (archive.hotelName) {
      await this.saveOrganization(archive.hotelName);
    }

    return archive;
  }
}
