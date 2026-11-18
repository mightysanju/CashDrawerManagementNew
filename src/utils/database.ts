import { openDB, IDBPDatabase } from 'idb';
import { 
  ShiftRecord, 
  UserAccount, 
  ShiftLogEntry, 
  ShiftLogResponse,
  ShiftLogStatusChange,
  ActivityLogEvent,
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

let globalDbPromise: Promise<IDBPDatabase> | null = null;

function getGlobalDb(): Promise<IDBPDatabase> {
  if (!globalDbPromise) {
    globalDbPromise = openDB(DB_NAME, DB_VERSION, {
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
      },
      blocked() {
        console.warn('[IndexedDB] Database connection blocked by an older connection.');
      },
      blocking(_currentVersion, _blockedVersion, event) {
        console.warn('[IndexedDB] Database is blocking a version upgrade. Closing stale handle.');
        try {
          (event?.target as unknown as { result?: { close?: () => void } })?.result?.close?.();
        } catch {
          // ignore
        }
        globalDbPromise = null;
      },
      terminated() {
        console.warn('[IndexedDB] Database connection terminated abnormally. Resetting.');
        globalDbPromise = null;
      },
    }).then(async (db) => {
      try {
        await seedDatabaseDefaults(db);
      } catch (err) {
        console.warn('Seed defaults notice:', err);
      }
      return db;
    });
  }
  return globalDbPromise;
}

async function seedDatabaseDefaults(db: IDBPDatabase) {
  try {
    // 1. Seed Categories if empty
    const catCount = await db.count(STORES.CATEGORIES);
    if (catCount === 0) {
      const tx = db.transaction(STORES.CATEGORIES, 'readwrite');
      const defaultCategories: LogCategoryConfig[] = [
        {
          id: 'cat_sales',
          name: 'Sales',
          icon: 'Building2',
          subcategories: ['Group', 'Wedding', 'Sports team', 'Company', 'Bus Tour', 'Family Reunion'],
          rateMultiplier: 120,
        },
        {
          id: 'cat_complaint',
          name: 'Complaint',
          icon: 'AlertTriangle',
          subcategories: ['Room Maintenance', 'Noise / Disturbance', 'Billing & Folio', 'Housekeeping / Cleanliness', 'Staff / Service', 'Other'],
        },
        {
          id: 'cat_misc',
          name: 'Miscellaneous',
          icon: 'Tag',
          subcategories: ['Shift Handover', 'Package Delivery', 'Lost & Found', 'Maintenance Request', 'Manager Note'],
        },
      ];
      for (const cat of defaultCategories) {
        await tx.store.put(cat);
      }
      await tx.done;
      syncCategoriesToExtensionStorage(defaultCategories);
    }

    // 2. Seed Settings if empty
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

export function syncCategoriesToExtensionStorage(cats: LogCategoryConfig[]): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('frontdesk_categories_cache', JSON.stringify(cats));
      window.postMessage({ type: 'FDP_CATEGORIES_SYNC', categories: cats }, '*');
    }
    // Also direct chrome storage if accessible in this context
    // @ts-ignore
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      // @ts-ignore
      chrome.storage.local.set({ frontdesk_categories: cats });
    }
  } catch {
    // ignore
  }
}

export class DatabaseManager {
  private get dbPromise(): Promise<IDBPDatabase> {
    return getGlobalDb();
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

  /**
   * Intelligently merges an incoming shift log with any existing shift log in the store.
   * - Preserves and unions all threaded replies/responses by ID so no reply is ever lost.
   * - Preserves and unions all status history transitions for a robust audit trail.
   * - Resolves complaintStatus and salesStatus using the latest transition in statusHistory as the authoritative source of truth.
   * - Adopts incoming fields if newer, but preserves newer local updates if incoming is stale.
   */
  private mergeShiftLogRecords(existing: ShiftLogEntry, incoming: ShiftLogEntry): ShiftLogEntry {
    const respMap = new Map<string, ShiftLogResponse>();
    (existing.responses || []).forEach((r) => {
      if (r && r.id) respMap.set(r.id, r);
    });
    (incoming.responses || []).forEach((r) => {
      if (r && r.id) respMap.set(r.id, r);
    });

    const mergedResponses = Array.from(respMap.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
    const incomingTime = new Date(incoming.updatedAt || incoming.createdAt || 0).getTime();

    // Union status history transitions
    const statusMap = new Map<string, ShiftLogStatusChange>();
    (existing.statusHistory || []).forEach((s) => {
      if (s && s.id) statusMap.set(s.id, s);
    });
    (incoming.statusHistory || []).forEach((s) => {
      if (s && s.id) statusMap.set(s.id, s);
    });
    const mergedStatusHistory = Array.from(statusMap.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Pick base object based on timestamp (LWW)
    const base = incomingTime >= existingTime ? { ...existing, ...incoming } : { ...incoming, ...existing };

    // Resolve authoritative complaintStatus:
    // If statusHistory has transitions, the latest transition in history is ALWAYS the true state!
    let authoritativeComplaintStatus = base.complaintStatus;
    if (mergedStatusHistory.length > 0) {
      const latestChange = mergedStatusHistory[mergedStatusHistory.length - 1];
      if (latestChange && latestChange.toStatus) {
        authoritativeComplaintStatus = latestChange.toStatus as ComplaintStatus;
      }
    } else if (existing.complaintStatus && (!incoming.complaintStatus || incoming.complaintStatus === 'Open')) {
      // Preserve existing non-Open status over a stale default Open from incoming
      authoritativeComplaintStatus = existing.complaintStatus;
    }

    // Resolve authoritative salesStatus:
    let authoritativeSalesStatus = base.salesStatus;
    if (mergedStatusHistory.length > 0 && (base.category === 'Sales' || existing.category === 'Sales')) {
      const latestChange = mergedStatusHistory[mergedStatusHistory.length - 1];
      if (latestChange && latestChange.toStatus) {
        authoritativeSalesStatus = latestChange.toStatus as SalesLeadStatus;
      }
    } else if (existing.salesStatus && (!incoming.salesStatus || incoming.salesStatus === 'New Lead')) {
      authoritativeSalesStatus = existing.salesStatus;
    }

    return {
      ...base,
      complaintStatus: authoritativeComplaintStatus,
      salesStatus: authoritativeSalesStatus,
      responses: mergedResponses,
      statusHistory: mergedStatusHistory,
      updatedAt: new Date(Math.max(existingTime, incomingTime)).toISOString(),
    };
  }

  /* -------------------------------------------------------------
   *  Tombstone Protection (Prevents Resurrection of Deleted Logs)
   * ------------------------------------------------------------- */
  getDeletedLogIds(): Set<string> {
    try {
      const stored = localStorage.getItem('cdm_deleted_log_ids');
      return new Set(stored ? JSON.parse(stored) : []);
    } catch {
      return new Set();
    }
  }

  addDeletedLogId(logId: string): void {
    try {
      const ids = this.getDeletedLogIds();
      ids.add(logId);
      const arr = Array.from(ids).slice(-1000);
      localStorage.setItem('cdm_deleted_log_ids', JSON.stringify(arr));
    } catch {}
  }

  isLogDeleted(logId: string): boolean {
    return this.getDeletedLogIds().has(logId);
  }

  async saveShiftLog(log: ShiftLogEntry): Promise<void> {
    if (!log || !log.id) return;
    if (this.isLogDeleted(log.id)) {
      return; // Do not resurrect deleted logs!
    }

    const db = await this.dbPromise;
    const existing = await db.get(STORES.SHIFT_LOGS, log.id);
    const finalLog = existing ? this.mergeShiftLogRecords(existing, log) : log;
    await db.put(STORES.SHIFT_LOGS, finalLog);
  }

  async deleteShiftLog(logId: string): Promise<void> {
    this.addDeletedLogId(logId);
    const db = await this.dbPromise;
    await db.delete(STORES.SHIFT_LOGS, logId);
  }

  async bulkSaveShiftLogs(logs: ShiftLogEntry[]): Promise<void> {
    if (!logs || logs.length === 0) return;
    const deletedIds = this.getDeletedLogIds();
    const db = await this.dbPromise;
    const tx = db.transaction(STORES.SHIFT_LOGS, 'readwrite');
    for (const log of logs) {
      if (!log || !log.id || deletedIds.has(log.id)) continue;
      const existing = await tx.store.get(log.id);
      const finalLog = existing ? this.mergeShiftLogRecords(existing, log) : log;
      await tx.store.put(finalLog);
    }
    await tx.done;
  }

  /* -------------------------------------------------------------
   *  Activity Tracker Operations (Full Lifecycle Audit Trail)
   * ------------------------------------------------------------- */
  async getActivityEvents(): Promise<ActivityLogEvent[]> {
    try {
      const stored = localStorage.getItem('cdm_activity_events');
      if (!stored) return [];
      const parsed: ActivityLogEvent[] = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Error reading activity events:', e);
      return [];
    }
  }

  async saveActivityEvent(event: ActivityLogEvent): Promise<void> {
    if (!event || !event.id) return;
    try {
      const events = await this.getActivityEvents();
      const existingIdx = events.findIndex(e => e.id === event.id);
      if (existingIdx >= 0) {
        events[existingIdx] = event;
      } else {
        events.unshift(event);
      }
      const trimmed = events.slice(0, 500);
      localStorage.setItem('cdm_activity_events', JSON.stringify(trimmed));
    } catch (e) {
      console.error('Error saving activity event:', e);
    }
  }

  async bulkSaveActivityEvents(newEvents: ActivityLogEvent[]): Promise<void> {
    if (!newEvents || newEvents.length === 0) return;
    try {
      const events = await this.getActivityEvents();
      const map = new Map<string, ActivityLogEvent>();
      events.forEach(e => map.set(e.id, e));
      newEvents.forEach(e => {
        if (e && e.id) map.set(e.id, e);
      });
      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ).slice(0, 500);
      localStorage.setItem('cdm_activity_events', JSON.stringify(merged));
    } catch (e) {
      console.error('Error bulk saving activity events:', e);
    }
  }

  /* -------------------------------------------------------------
   *  Categories Operations
   * ------------------------------------------------------------- */
  async getCategories(): Promise<LogCategoryConfig[]> {
    const db = await this.dbPromise;
    const cats = await db.getAll(STORES.CATEGORIES);
    if (cats && cats.length > 0) {
      syncCategoriesToExtensionStorage(cats);
    }
    return cats;
  }

  async saveCategory(cat: LogCategoryConfig): Promise<void> {
    const db = await this.dbPromise;
    await db.put(STORES.CATEGORIES, cat);
    const all = await db.getAll(STORES.CATEGORIES);
    syncCategoriesToExtensionStorage(all);
  }

  async deleteCategory(catId: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(STORES.CATEGORIES, catId);
    const all = await db.getAll(STORES.CATEGORIES);
    syncCategoriesToExtensionStorage(all);
  }

  async bulkSaveCategories(cats: LogCategoryConfig[]): Promise<void> {
    if (!cats || cats.length === 0) return;
    const db = await this.dbPromise;
    const tx = db.transaction(STORES.CATEGORIES, 'readwrite');
    for (const c of cats) {
      await tx.store.put(c);
    }
    await tx.done;
    const all = await db.getAll(STORES.CATEGORIES);
    syncCategoriesToExtensionStorage(all);
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
        icon: 'Building2',
        subcategories: ['Group', 'Wedding', 'Sports team', 'Company', 'Bus Tour', 'Family Reunion'],
        rateMultiplier: 120,
      },
      {
        id: 'cat_complaint',
        name: 'Complaint',
        icon: 'AlertTriangle',
        subcategories: ['Room Maintenance', 'Noise / Disturbance', 'Billing & Folio', 'Housekeeping / Cleanliness', 'Staff / Service', 'Other'],
      },
      {
        id: 'cat_misc',
        name: 'Miscellaneous',
        icon: 'Tag',
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
