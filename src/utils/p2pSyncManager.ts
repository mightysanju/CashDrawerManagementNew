import Peer, { DataConnection } from 'peerjs';
import { 
  ShiftRecord, 
  ShiftLogEntry, 
  LogCategoryConfig, 
  UserAccount, 
  AppSettings,
  DatabaseArchive
} from '../types';
import { DatabaseManager } from './database';

export type SyncMessage =
  | { 
      type: 'FULL_SYNC'; 
      shifts: ShiftRecord[]; 
      shiftLogs?: ShiftLogEntry[];
      categories?: LogCategoryConfig[];
      users?: UserAccount[];
      settings?: AppSettings;
      databaseEpoch?: number;
      databaseId?: string;
      senderId?: string 
    }
  | { type: 'SHIFT_UPSERT'; shift: ShiftRecord; senderId?: string }
  | { type: 'SHIFT_LOG_UPSERT'; log: ShiftLogEntry; senderId?: string }
  | { type: 'SHIFT_LOG_DELETE'; logId: string; senderId?: string }
  | { type: 'CATEGORY_UPSERT'; category: LogCategoryConfig; senderId?: string }
  | { type: 'CATEGORY_DELETE'; categoryId: string; senderId?: string }
  | { type: 'USER_UPSERT'; user: UserAccount; senderId?: string }
  | { type: 'USER_DELETE'; userId: string; senderId?: string }
  | { type: 'SETTINGS_UPDATE'; settings: AppSettings; senderId?: string }
  | { type: 'HISTORY_CLEARED'; senderId?: string }
  | { type: 'HEARTBEAT'; senderId?: string }
  | { 
      type: 'DATABASE_ARCHIVED_AND_PURGED'; 
      archive: DatabaseArchive; 
      syncGroupToDelete: string; 
      purgedEpoch?: number;
      senderId?: string;
    }
  | { 
      type: 'DATABASE_RESTORED_FROM_ARCHIVE'; 
      archive: DatabaseArchive; 
      syncGroupName: string; 
      senderId?: string;
    }
  | {
      type: 'DATABASE_INITIALIZED';
      hotelName: string;
      syncGroup: string;
      databaseEpoch: number;
      databaseId: string;
      managerUser?: UserAccount;
      settings: AppSettings;
      senderId?: string;
    };

export type SyncRole = 'hub' | 'client' | 'standalone';
export type SyncStatus = 'disconnected' | 'scanning' | 'connected' | 'error';

export interface SyncState {
  status: SyncStatus;
  role: SyncRole;
  storeName: string;
  connectedCount: number;
  myPeerId: string | null;
  errorMessage: string | null;
}

const PEER_PREFIX = 'cdm-lan-v3-';
const db = new DatabaseManager();

// Google's public STUN servers for reliable local LAN / Wi-Fi NAT traversal
const STUN_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ],
};

class P2PSyncManager {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private broadcastChannel: BroadcastChannel | null = null;
  private storeSlug: string = 'main-store';
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;
  private myClientId: string = '';

  private state: SyncState = {
    status: 'disconnected',
    role: 'standalone',
    storeName: 'Main Store',
    connectedCount: 0,
    myPeerId: null,
    errorMessage: null,
  };

  private stateListeners: Set<(state: SyncState) => void> = new Set();
  private dataListeners: Set<(action: string, data?: unknown) => void> = new Set();

  constructor() {
    try {
      const saved = localStorage.getItem('cdm_store_name');
      if (saved && saved.trim() && saved.trim().toLowerCase() !== 'main store') {
        this.state.storeName = saved.trim();
        this.storeSlug = this.sanitizeSlug(saved.trim());
      }
    } catch {
      // ignore
    }
    this.initBroadcastChannel();
  }

  /**
   * Initializes native BroadcastChannel for instant zero-latency sync across
   * tabs / windows on the same machine, scoped to the current hotel slug
   */
  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        if (this.broadcastChannel) {
          try {
            this.broadcastChannel.close();
          } catch {
            // ignore
          }
        }
        const channelName = `cdm_lan_broadcast_${this.storeSlug}`;
        this.broadcastChannel = new BroadcastChannel(channelName);
        this.broadcastChannel.onmessage = async (event) => {
          const msg = event.data as SyncMessage;
          if (!msg || !msg.type || msg.senderId === this.myClientId) return;
          await this.processIncomingMessage(msg);
        };
      } catch (err) {
        console.debug('BroadcastChannel not available:', err);
      }
    }
  }

  public getKnownSyncGroups(): string[] {
    try {
      const raw = localStorage.getItem('cdm_known_sync_groups');
      const list: string[] = raw ? JSON.parse(raw) : [];
      if (this.state.storeName && !list.includes(this.state.storeName)) {
        list.unshift(this.state.storeName);
      }
      return Array.from(new Set(list.filter(Boolean)));
    } catch {
      return this.state.storeName ? [this.state.storeName] : [];
    }
  }

  public rememberSyncGroup(groupName: string) {
    if (!groupName || !groupName.trim()) return;
    try {
      const trimmed = groupName.trim();
      const current = this.getKnownSyncGroups();
      if (!current.includes(trimmed)) {
        current.unshift(trimmed);
      }
      localStorage.setItem('cdm_known_sync_groups', JSON.stringify(current));
    } catch {
      // ignore
    }
  }

  public removeKnownSyncGroup(groupName: string) {
    try {
      const current = this.getKnownSyncGroups().filter((g) => g !== groupName);
      localStorage.setItem('cdm_known_sync_groups', JSON.stringify(current));
    } catch {
      // ignore
    }
  }

  public async switchSyncGroup(newStoreName: string): Promise<void> {
    const trimmed = newStoreName.trim();
    if (!trimmed) return;
    this.disconnect();
    this.rememberSyncGroup(trimmed);
    await this.autoConnect(trimmed);
  }

  public getState(): SyncState {
    return { ...this.state };
  }

  public subscribeState(listener: (state: SyncState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => this.stateListeners.delete(listener);
  }

  public subscribeData(listener: (action: string, data?: unknown) => void): () => void {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  private updateState(partial: Partial<SyncState>) {
    this.state = { ...this.state, ...partial };
    this.stateListeners.forEach((listener) => listener(this.getState()));
  }

  private getHubPeerId(slug: string): string {
    return `${PEER_PREFIX}hub-${slug}`;
  }

  private getClientPeerId(slug: string): string {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `${PEER_PREFIX}node-${slug}-${randomSuffix}`;
  }

  private sanitizeSlug(name: string): string {
    const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return clean || 'hotel-main';
  }

  /**
   * Automatically scans local network:
   * 1. Attempts to become the Primary Hub for this store.
   * 2. If the Hub is already active on another machine, connects to it as a client peer.
   */
  public async autoConnect(storeName?: string) {
    if (this.isConnecting) return;
    this.isConnecting = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    let currentStore = storeName;
    if (!currentStore) {
      try {
        const saved = localStorage.getItem('cdm_store_name');
        if (saved && saved.trim() && saved.trim().toLowerCase() !== 'main store') {
          currentStore = saved.trim();
        } else {
          const org = await db.getOrganization();
          if (org && org.name && org.name.trim()) {
            currentStore = org.name.trim();
          } else {
            currentStore = this.state.storeName || 'Sunset Palms Beach Resort';
          }
        }
      } catch {
        currentStore = this.state.storeName || 'Sunset Palms Beach Resort';
      }
    }

    this.storeSlug = this.sanitizeSlug(currentStore);
    this.initBroadcastChannel();

    try {
      localStorage.setItem('cdm_store_name', currentStore);
      this.rememberSyncGroup(currentStore);
    } catch {
      // ignore
    }

    this.updateState({
      status: 'scanning',
      storeName: currentStore,
      errorMessage: null,
    });

    const hubId = this.getHubPeerId(this.storeSlug);

    try {
      // Step 1: Try to claim the Hub role
      await this.tryHostHub(hubId);
    } catch {
      // Step 2: Hub exists! Connect as Client
      try {
        await this.connectAsClient(hubId);
      } catch (err: unknown) {
        console.debug('Client connection attempt failed, scheduling auto-retry:', err);
        this.updateState({
          status: 'error',
          errorMessage: 'Unable to reach register hub. Retrying in background...',
        });
        this.scheduleReconnect(currentStore);
      }
    } finally {
      this.isConnecting = false;
      this.startHeartbeat();
    }
  }

  /**
   * Tries to bind as the Primary Hub
   */
  private tryHostHub(hubId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.cleanupPeer();

      let peer: Peer;
      try {
        peer = new Peer(hubId, {
          config: STUN_CONFIG,
          debug: 1,
        });
      } catch (e) {
        reject(e);
        return;
      }

      let settled = false;

      peer.on('open', (id) => {
        settled = true;
        this.peer = peer;
        this.myClientId = id;
        this.updateState({
          status: 'connected',
          role: 'hub',
          myPeerId: id,
          connectedCount: 0,
          errorMessage: null,
        });

        peer.on('connection', (conn) => {
          this.handleIncomingConnection(conn);
        });

        resolve();
      });

      peer.on('error', (err) => {
        if (!settled) {
          settled = true;
          try {
            peer.destroy();
          } catch {
            // ignore
          }
          reject(err);
        } else {
          console.error('Hub error after active:', err);
        }
      });
    });
  }

  /**
   * Connects to the existing Primary Hub as a Client Peer
   */
  private connectAsClient(hubId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.cleanupPeer();

      const clientId = this.getClientPeerId(this.storeSlug);
      let peer: Peer;
      try {
        peer = new Peer(clientId, {
          config: STUN_CONFIG,
          debug: 1,
        });
      } catch (e) {
        reject(e);
        return;
      }

      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          try {
            peer.destroy();
          } catch {
            // ignore
          }
          reject(new Error('Connection timeout to hub'));
        }
      }, 6000);

      peer.on('open', (myId) => {
        this.peer = peer;
        this.myClientId = myId;

        const conn = peer.connect(hubId, { reliable: true });

        const setupClient = async () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);

          this.connections.set(conn.peer, conn);
          this.setupConnectionHandlers(conn);

          this.updateState({
            status: 'connected',
            role: 'client',
            myPeerId: myId,
            connectedCount: 1,
            errorMessage: null,
          });

          // Send local database to Hub for two-way merge
          try {
            const [localShifts, localLogs, localCats, localUsers, localSettings] = await Promise.all([
              db.getAllShifts(),
              db.getShiftLogs(),
              db.getCategories(),
              db.getUsers(),
              db.getSettings(),
            ]);

            if (conn.open) {
              conn.send({
                type: 'FULL_SYNC',
                shifts: localShifts,
                shiftLogs: localLogs,
                categories: localCats,
                users: localUsers,
                settings: localSettings,
                databaseEpoch: localSettings.databaseEpoch || 0,
                databaseId: localSettings.databaseId || 'default',
                senderId: myId,
              });
            }
          } catch (e) {
            console.error('Error sending local data on connect:', e);
          }

          resolve();
        };

        if (conn.open) {
          setupClient();
        } else {
          conn.on('open', setupClient);
        }

        conn.on('error', (err) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            try {
              peer.destroy();
            } catch {
              // ignore
            }
            reject(err);
          }
        });

        conn.on('close', () => {
          this.connections.delete(conn.peer);
          this.updateState({
            status: 'disconnected',
            connectedCount: 0,
          });
          this.scheduleReconnect(this.state.storeName);
        });
      });

      peer.on('error', (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          try {
            peer.destroy();
          } catch {
            // ignore
          }
          reject(err);
        }
      });
    });
  }

  /**
   * Handles incoming peer connections on the Hub
   */
  private handleIncomingConnection(conn: DataConnection) {
    const setupHubConn = async () => {
      this.connections.set(conn.peer, conn);
      this.setupConnectionHandlers(conn);
      this.updateState({ connectedCount: this.connections.size });

      // Automatically send the Hub's full state (shifts, logs, categories, users, settings) to joining node
      try {
        const [allShifts, allLogs, allCats, allUsers, allSettings] = await Promise.all([
          db.getAllShifts(),
          db.getShiftLogs(),
          db.getCategories(),
          db.getUsers(),
          db.getSettings(),
        ]);

        if (conn.open) {
          conn.send({
            type: 'FULL_SYNC',
            shifts: allShifts,
            shiftLogs: allLogs,
            categories: allCats,
            users: allUsers,
            settings: allSettings,
            databaseEpoch: allSettings.databaseEpoch || 0,
            databaseId: allSettings.databaseId || 'default',
            senderId: this.myClientId,
          });
        }
      } catch (err) {
        console.error('Error sending initial sync to joined peer:', err);
      }
    };

    if (conn.open) {
      setupHubConn();
    } else {
      conn.on('open', setupHubConn);
    }
  }

  private async sendFullSyncToPeer(peerId?: string, forceSettings?: AppSettings) {
    if (!peerId) return;
    const targetConn = this.connections.get(peerId);
    if (!targetConn || !targetConn.open) return;

    try {
      const [allShifts, allLogs, allCats, allUsers, currentSettings] = await Promise.all([
        db.getAllShifts(),
        db.getShiftLogs(),
        db.getCategories(),
        db.getUsers(),
        forceSettings || db.getSettings(),
      ]);

      targetConn.send({
        type: 'FULL_SYNC',
        shifts: allShifts,
        shiftLogs: allLogs,
        categories: allCats,
        users: allUsers,
        settings: currentSettings,
        databaseEpoch: currentSettings.databaseEpoch || 0,
        databaseId: currentSettings.databaseId || 'default',
        senderId: this.myClientId,
      });
    } catch (e) {
      console.error('Error sending full sync to peer:', e);
    }
  }

  private async processIncomingMessage(msg: SyncMessage, relayFromPeerId?: string) {
    if (!msg || !msg.type) return;

    if (msg.type === 'FULL_SYNC') {
      const incomingEpoch = msg.databaseEpoch || msg.settings?.databaseEpoch || 0;
      const localSettings = await db.getSettings();
      const localEpoch = localSettings.databaseEpoch || 0;
      const lastPurgedEpoch = parseInt(localStorage.getItem('cdm_last_purged_epoch') || '0', 10);

      // 1. Guard against resurrected obsolete/purged databases
      if (incomingEpoch > 0 && incomingEpoch <= lastPurgedEpoch && localEpoch > incomingEpoch) {
        console.warn(`[P2P Sync] Rejected obsolete database (epoch ${incomingEpoch} <= purged ${lastPurgedEpoch}). Propagating current database.`);
        this.sendFullSyncToPeer(relayFromPeerId, localSettings);
        return;
      }

      // 2. If remote peer has an older database superseded by a newer one created here
      if (localEpoch > 0 && incomingEpoch > 0 && incomingEpoch < localEpoch) {
        console.warn(`[P2P Sync] Remote database epoch ${incomingEpoch} is older than local ${localEpoch}. Overwriting remote peer.`);
        this.sendFullSyncToPeer(relayFromPeerId, localSettings);
        return;
      }

      // 3. If local database is older than remote's newly created database, adopt remote
      if (localEpoch > 0 && incomingEpoch > 0 && incomingEpoch > localEpoch) {
        console.warn(`[P2P Sync] Remote database epoch ${incomingEpoch} is newer than local ${localEpoch}. Auto-archiving local and adopting new database.`);
        try {
          const currentSyncGroup = this.state.storeName || 'Main Store';
          await db.createDatabaseArchive('Auto-Archive (Superseded DB)', currentSyncGroup);
        } catch (e) {
          console.error('Failed to auto-archive local data before adopting newer DB:', e);
        }
        await db.resetDatabaseToFactoryDefaults();
      }

      if (msg.shifts && Array.isArray(msg.shifts)) {
        await db.bulkSaveShifts(msg.shifts);
      }
      if (msg.shiftLogs && Array.isArray(msg.shiftLogs)) {
        await db.bulkSaveShiftLogs(msg.shiftLogs);
      }
      if (msg.categories && Array.isArray(msg.categories)) {
        await db.bulkSaveCategories(msg.categories);
      }
      if (msg.users && Array.isArray(msg.users)) {
        await db.bulkSaveUsers(msg.users);
      }
      if (msg.settings) {
        await db.saveSettings(msg.settings);
        if (msg.settings.organizationName) {
          await db.saveOrganization(msg.settings.organizationName);
          localStorage.setItem('cdm_store_name', msg.settings.organizationName);
        }
      }
      this.notifyData('SYNC_COMPLETED', msg);
    } else if (msg.type === 'SHIFT_UPSERT' && msg.shift) {
      await db.saveShift(msg.shift);
      this.notifyData('SHIFT_UPDATED', msg.shift);
      this.relayIfHub(msg, relayFromPeerId);
    } else if (msg.type === 'SHIFT_LOG_UPSERT' && msg.log) {
      await db.saveShiftLog(msg.log);
      this.notifyData('SHIFT_LOG_UPDATED', msg.log);
      this.relayIfHub(msg, relayFromPeerId);
    } else if (msg.type === 'SHIFT_LOG_DELETE' && msg.logId) {
      await db.deleteShiftLog(msg.logId);
      this.notifyData('SHIFT_LOG_DELETED', msg.logId);
      this.relayIfHub(msg, relayFromPeerId);
    } else if (msg.type === 'CATEGORY_UPSERT' && msg.category) {
      await db.saveCategory(msg.category);
      this.notifyData('CATEGORY_UPDATED', msg.category);
      this.relayIfHub(msg, relayFromPeerId);
    } else if (msg.type === 'CATEGORY_DELETE' && msg.categoryId) {
      await db.deleteCategory(msg.categoryId);
      this.notifyData('CATEGORY_DELETED', msg.categoryId);
      this.relayIfHub(msg, relayFromPeerId);
    } else if (msg.type === 'USER_UPSERT' && msg.user) {
      await db.saveUser(msg.user);
      this.notifyData('USER_UPDATED', msg.user);
      this.relayIfHub(msg, relayFromPeerId);
    } else if (msg.type === 'USER_DELETE' && msg.userId) {
      await db.deleteUser(msg.userId);
      this.notifyData('USER_DELETED', msg.userId);
      this.relayIfHub(msg, relayFromPeerId);
    } else if (msg.type === 'SETTINGS_UPDATE' && msg.settings) {
      await db.saveSettings(msg.settings);
      this.notifyData('SETTINGS_UPDATED', msg.settings);
      this.relayIfHub(msg, relayFromPeerId);
    } else if (msg.type === 'HISTORY_CLEARED') {
      await db.clearHistory();
      this.notifyData('HISTORY_CLEARED');
      this.relayIfHub(msg, relayFromPeerId);
    } else if (msg.type === 'DATABASE_ARCHIVED_AND_PURGED' && msg.archive) {
      db.saveDatabaseArchive(msg.archive);
      await db.resetDatabaseToFactoryDefaults();
      if (msg.purgedEpoch) {
        localStorage.setItem('cdm_last_purged_epoch', String(msg.purgedEpoch));
      }
      if (msg.syncGroupToDelete) {
        this.removeKnownSyncGroup(msg.syncGroupToDelete);
        const currentSaved = localStorage.getItem('cdm_store_name');
        if (currentSaved === msg.syncGroupToDelete) {
          localStorage.removeItem('cdm_store_name');
        }
      }
      localStorage.removeItem('cdm_local_active_shift_id');
      localStorage.removeItem('frontdesk_external_logs');
      try {
        sessionStorage.clear();
      } catch {
        // ignore
      }
      authManager.logout();
      this.notifyData('DATABASE_PURGED', msg);
      this.relayIfHub(msg, relayFromPeerId);
    } else if (msg.type === 'DATABASE_INITIALIZED' && msg.settings) {
      await db.saveSettings(msg.settings);
      if (msg.hotelName) {
        await db.saveOrganization(msg.hotelName);
      }
      if (msg.managerUser) {
        await db.saveUser(msg.managerUser);
      }
      if (msg.syncGroup) {
        this.rememberSyncGroup(msg.syncGroup);
        localStorage.setItem('cdm_store_name', msg.syncGroup);
      }
      this.notifyData('DATABASE_INITIALIZED', msg);
      this.relayIfHub(msg, relayFromPeerId);
    } else if (msg.type === 'DATABASE_RESTORED_FROM_ARCHIVE' && msg.archive) {
      db.saveDatabaseArchive(msg.archive);
      await db.restoreDatabaseFromArchive(msg.archive.id);
      if (msg.syncGroupName) {
        this.rememberSyncGroup(msg.syncGroupName);
        localStorage.setItem('cdm_store_name', msg.syncGroupName);
      }
      this.notifyData('DATABASE_RESTORED', msg);
      this.relayIfHub(msg, relayFromPeerId);
    }
  }

  private relayIfHub(msg: SyncMessage, excludePeerId?: string) {
    if (this.state.role === 'hub') {
      this.connections.forEach((otherConn) => {
        if (otherConn.peer !== excludePeerId && otherConn.open) {
          otherConn.send(msg);
        }
      });
    }
  }

  private setupConnectionHandlers(conn: DataConnection) {
    conn.on('data', async (raw) => {
      const msg = raw as SyncMessage;
      await this.processIncomingMessage(msg, conn.peer);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.updateState({ connectedCount: this.connections.size });
    });

    conn.on('error', () => {
      this.connections.delete(conn.peer);
      this.updateState({ connectedCount: this.connections.size });
    });
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.connections.size > 0) {
        const ping: SyncMessage = { type: 'HEARTBEAT', senderId: this.myClientId };
        this.connections.forEach((conn) => {
          if (conn.open) {
            try {
              conn.send(ping);
            } catch {
              // ignore
            }
          }
        });
      }
    }, 12000);
  }

  private scheduleReconnect(storeName: string) {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.autoConnect(storeName);
    }, 4000);
  }

  private notifyData(action: string, data?: unknown) {
    this.dataListeners.forEach((listener) => {
      try {
        listener(action, data);
      } catch (e) {
        console.error('Error in data listener:', e);
      }
    });
  }

  private sendToAll(msg: SyncMessage) {
    // 1. BroadcastChannel (local tabs/windows)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(msg);
      } catch {
        // ignore
      }
    }

    // 2. WebRTC DataChannels (LAN peers)
    if (this.connections.size > 0) {
      this.connections.forEach((conn) => {
        if (conn.open) {
          try {
            conn.send(msg);
          } catch {
            // ignore
          }
        }
      });
    }
  }

  /* -------------------------------------------------------------
   *  Public Broadcast Methods
   * ------------------------------------------------------------- */
  public broadcastShift(shift: ShiftRecord) {
    this.sendToAll({
      type: 'SHIFT_UPSERT',
      shift,
      senderId: this.myClientId,
    });
  }

  public broadcastShiftLog(log: ShiftLogEntry) {
    this.sendToAll({
      type: 'SHIFT_LOG_UPSERT',
      log,
      senderId: this.myClientId,
    });
  }

  public broadcastShiftLogDelete(logId: string) {
    this.sendToAll({
      type: 'SHIFT_LOG_DELETE',
      logId,
      senderId: this.myClientId,
    });
  }

  public broadcastCategory(category: LogCategoryConfig) {
    this.sendToAll({
      type: 'CATEGORY_UPSERT',
      category,
      senderId: this.myClientId,
    });
  }

  public broadcastCategoryDelete(categoryId: string) {
    this.sendToAll({
      type: 'CATEGORY_DELETE',
      categoryId,
      senderId: this.myClientId,
    });
  }

  public broadcastUser(user: UserAccount) {
    this.sendToAll({
      type: 'USER_UPSERT',
      user,
      senderId: this.myClientId,
    });
  }

  public broadcastUserDelete(userId: string) {
    this.sendToAll({
      type: 'USER_DELETE',
      userId,
      senderId: this.myClientId,
    });
  }

  public broadcastSettings(settings: AppSettings) {
    this.sendToAll({
      type: 'SETTINGS_UPDATE',
      settings,
      senderId: this.myClientId,
    });
  }

  public broadcastHistoryCleared() {
    this.sendToAll({
      type: 'HISTORY_CLEARED',
      senderId: this.myClientId,
    });
  }

  public broadcastDatabaseArchivedAndPurged(archive: DatabaseArchive, syncGroupToDelete: string, purgedEpoch?: number) {
    this.sendToAll({
      type: 'DATABASE_ARCHIVED_AND_PURGED',
      archive,
      syncGroupToDelete,
      purgedEpoch: purgedEpoch || Date.now(),
      senderId: this.myClientId,
    });
  }

  public broadcastNewDatabaseCreated(settings: AppSettings, managerUser: UserAccount, syncGroup: string) {
    this.sendToAll({
      type: 'DATABASE_INITIALIZED',
      hotelName: settings.organizationName,
      syncGroup,
      databaseEpoch: settings.databaseEpoch || Date.now(),
      databaseId: settings.databaseId || `db_${Date.now()}`,
      managerUser,
      settings,
      senderId: this.myClientId,
    });
  }

  public broadcastDatabaseRestored(archive: DatabaseArchive, syncGroupName: string) {
    this.sendToAll({
      type: 'DATABASE_RESTORED_FROM_ARCHIVE',
      archive,
      syncGroupName,
      senderId: this.myClientId,
    });
  }

  private cleanupPeer() {
    this.connections.forEach((conn) => {
      try {
        conn.close();
      } catch {
        // ignore
      }
    });
    this.connections.clear();

    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // ignore
      }
      this.peer = null;
    }
  }

  public disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.cleanupPeer();
    this.updateState({
      status: 'disconnected',
      role: 'standalone',
      connectedCount: 0,
      myPeerId: null,
      errorMessage: null,
    });
  }
}

export const p2pSyncManager = new P2PSyncManager();
