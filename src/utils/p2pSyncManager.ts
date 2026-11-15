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

export interface AvailableNetworkDatabase {
  name: string;
  epoch: number;
  databaseId?: string;
  peerId?: string;
  shiftsCount?: number;
  usersCount?: number;
  lastSeen: number;
  isHostedOnPeer: boolean;
  isActive: boolean;
  createdBy?: string;
  createdAt?: string | number;
}

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
      type: 'DATABASE_HARD_PURGE';
      archive?: DatabaseArchive;
      syncGroupToDelete?: string;
      oldSyncGroup?: string;
      purgedEpoch: number;
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
    }
  | {
      type: 'NETWORK_SWITCH_DATABASE';
      targetDatabase: string;
      targetDatabaseEpoch?: number;
      targetDatabaseId?: string;
      senderId?: string;
    }
  | {
      type: 'NETWORK_DATABASE_DELETED';
      databaseName: string;
      purgedEpoch: number;
      senderId?: string;
    }
  | {
      type: 'DISCOVERY_ANNOUNCE';
      databaseName: string;
      epoch: number;
      databaseId?: string;
      shiftsCount?: number;
      usersCount?: number;
      peerId: string;
      createdBy?: string;
      createdAt?: string | number;
      senderId?: string;
    }
  | {
      type: 'DISCOVERY_REGISTRY_SYNC';
      databases: AvailableNetworkDatabase[];
      senderId?: string;
    }
  | {
      type: 'DISCOVERY_PROBE';
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
const GLOBAL_BEACON_CHANNEL = 'cdm_lan_global_beacon';
const DISCOVERY_HUB_PEER_ID = 'cdm-lan-v3-beacon-hub';
const DISCOVERY_CLIENT_PREFIX = 'cdm-lan-v3-beacon-node-';

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
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private isConnecting: boolean = false;
  private myClientId: string = '';

  // Network Discovery Beacon fields
  private globalBroadcastChannel: BroadcastChannel | null = null;
  private discoveryPeer: Peer | null = null;
  private discoveryConnections: Map<string, DataConnection> = new Map();
  private isDiscoveryHub: boolean = false;
  private discoveredDatabases: Map<string, AvailableNetworkDatabase> = new Map();
  private discoveryHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private discoveryReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private discoveryClientId: string = '';

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
    this.initGlobalDiscovery();
  }

  /**
   * Initializes global discovery beacon across all tabs and network peers
   */
  private initGlobalDiscovery() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        if (this.globalBroadcastChannel) {
          try {
            this.globalBroadcastChannel.close();
          } catch {
            // ignore
          }
        }
        this.globalBroadcastChannel = new BroadcastChannel(GLOBAL_BEACON_CHANNEL);
        this.globalBroadcastChannel.onmessage = async (event) => {
          const msg = event.data as SyncMessage;
          if (!msg || !msg.type || msg.senderId === this.myClientId) return;
          await this.handleDiscoveryMessage(msg);
        };
      } catch (err) {
        console.debug('Global broadcast channel not available:', err);
      }
    }
    this.startDiscoveryPeer();
  }

  /**
   * Starts discovery peer to find all databases on the LAN
   */
  private async startDiscoveryPeer() {
    if (this.discoveryPeer) return;

    try {
      await this.tryHostDiscoveryHub();
    } catch {
      try {
        await this.connectAsDiscoveryClient();
      } catch (err) {
        console.debug('Discovery client connection notice:', err);
        this.scheduleDiscoveryReconnect();
      }
    }

    if (this.discoveryHeartbeatTimer) clearInterval(this.discoveryHeartbeatTimer);
    this.discoveryHeartbeatTimer = setInterval(() => {
      this.announceCurrentDatabase();
      this.pruneOldDiscoveredDatabases();
    }, 10000);
  }

  private tryHostDiscoveryHub(): Promise<void> {
    return new Promise((resolve, reject) => {
      let peer: Peer;
      try {
        peer = new Peer(DISCOVERY_HUB_PEER_ID, {
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
        this.discoveryPeer = peer;
        this.discoveryClientId = id;
        this.isDiscoveryHub = true;

        peer.on('connection', (conn) => {
          this.discoveryConnections.set(conn.peer, conn);
          conn.on('data', async (raw) => {
            const msg = raw as SyncMessage;
            await this.handleDiscoveryMessage(msg, conn.peer);
          });
          conn.on('close', () => {
            this.discoveryConnections.delete(conn.peer);
          });
          conn.on('error', () => {
            this.discoveryConnections.delete(conn.peer);
          });

          // Deliver current database registry to connecting peer
          if (conn.open) {
            conn.send({
              type: 'DISCOVERY_REGISTRY_SYNC',
              databases: this.getAvailableNetworkDatabases(),
              senderId: this.myClientId,
            });
          }
        });

        this.announceCurrentDatabase();
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
        }
      });
    });
  }

  private connectAsDiscoveryClient(): Promise<void> {
    return new Promise((resolve, reject) => {
      const clientId = `${DISCOVERY_CLIENT_PREFIX}${Math.floor(1000 + Math.random() * 9000)}`;
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
          reject(new Error('Discovery hub connection timed out'));
        }
      }, 5000);

      peer.on('open', (myId) => {
        this.discoveryPeer = peer;
        this.discoveryClientId = myId;
        this.isDiscoveryHub = false;

        const conn = peer.connect(DISCOVERY_HUB_PEER_ID, { reliable: true });

        const setupClient = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          this.discoveryConnections.set(conn.peer, conn);

          conn.on('data', async (raw) => {
            const msg = raw as SyncMessage;
            await this.handleDiscoveryMessage(msg);
          });

          conn.on('close', () => {
            this.discoveryConnections.delete(conn.peer);
            this.scheduleDiscoveryReconnect();
          });

          conn.on('error', () => {
            this.discoveryConnections.delete(conn.peer);
            this.scheduleDiscoveryReconnect();
          });

          this.announceCurrentDatabase();
          resolve();
        };

        if (conn.open) {
          setupClient();
        } else {
          conn.on('open', setupClient);
        }
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

  private scheduleDiscoveryReconnect() {
    if (this.discoveryReconnectTimer) return;
    this.discoveryReconnectTimer = setTimeout(() => {
      this.discoveryReconnectTimer = null;
      if (this.discoveryPeer) {
        try {
          this.discoveryPeer.destroy();
        } catch {
          // ignore
        }
        this.discoveryPeer = null;
      }
      this.startDiscoveryPeer();
    }, 3000 + Math.random() * 2000);
  }

  private async handleDiscoveryMessage(msg: SyncMessage, relayFromPeerId?: string) {
    if (!msg || !msg.type) return;

    if (msg.type === 'DISCOVERY_ANNOUNCE') {
      const dbName = msg.databaseName?.trim();
      if (!dbName) return;

      this.rememberSyncGroup(dbName, { createdBy: msg.createdBy, createdAt: msg.createdAt });
      const isRemote = msg.senderId !== this.myClientId;
      const existing = this.discoveredDatabases.get(dbName);

      this.discoveredDatabases.set(dbName, {
        name: dbName,
        epoch: msg.epoch || 0,
        databaseId: msg.databaseId,
        peerId: msg.peerId,
        shiftsCount: typeof msg.shiftsCount === 'number' ? msg.shiftsCount : existing?.shiftsCount,
        usersCount: typeof msg.usersCount === 'number' ? msg.usersCount : existing?.usersCount,
        lastSeen: Date.now(),
        isHostedOnPeer: isRemote,
        isActive: dbName === this.state.storeName,
        createdBy: msg.createdBy || existing?.createdBy,
        createdAt: msg.createdAt || existing?.createdAt,
      });

      // Relay to other discovery peers if we are Discovery Hub
      if (this.isDiscoveryHub) {
        this.discoveryConnections.forEach((conn) => {
          if (conn.peer !== relayFromPeerId && conn.open) {
            try {
              conn.send(msg);
            } catch {
              // ignore
            }
          }
        });
      }

      this.notifyData('AVAILABLE_DATABASES_UPDATED', this.getAvailableNetworkDatabases());
    } else if (msg.type === 'DISCOVERY_REGISTRY_SYNC' && Array.isArray(msg.databases)) {
      for (const d of msg.databases) {
        if (d && d.name) {
          this.rememberSyncGroup(d.name);
          const isRemote = d.peerId !== this.myClientId;
          this.discoveredDatabases.set(d.name, {
            ...d,
            isHostedOnPeer: isRemote,
            isActive: d.name === this.state.storeName,
          });
        }
      }
      this.notifyData('AVAILABLE_DATABASES_UPDATED', this.getAvailableNetworkDatabases());
    } else if (msg.type === 'NETWORK_SWITCH_DATABASE') {
      if (this.isDiscoveryHub) {
        this.discoveryConnections.forEach((conn) => {
          if (conn.peer !== relayFromPeerId && conn.open) {
            try {
              conn.send(msg);
            } catch {
              // ignore
            }
          }
        });
      }

      if (msg.targetDatabase && msg.targetDatabase !== this.state.storeName) {
        console.warn(`[P2P Sync] Network command received to switch database to: "${msg.targetDatabase}". Following sync...`);
        await this.switchSyncGroup(msg.targetDatabase);
        this.notifyData('NETWORK_SWITCH_FOLLOWED', msg.targetDatabase);
      }
    } else if (msg.type === 'NETWORK_DATABASE_DELETED') {
      if (this.isDiscoveryHub) {
        this.discoveryConnections.forEach((conn) => {
          if (conn.peer !== relayFromPeerId && conn.open) {
            try {
              conn.send(msg);
            } catch {
              // ignore
            }
          }
        });
      }

      this.discoveredDatabases.delete(msg.databaseName);
      this.removeKnownSyncGroup(msg.databaseName);

      if (this.state.storeName === msg.databaseName) {
        console.warn(`[P2P Sync] Active database "${msg.databaseName}" was deleted across the network. Purging local copy.`);
        await db.resetDatabaseToFactoryDefaults();
        localStorage.removeItem('cdm_store_name');
        localStorage.removeItem('cdm_local_active_shift_id');
        localStorage.removeItem('frontdesk_external_logs');
        localStorage.removeItem('cdm_session_user');
        localStorage.removeItem('frontdesk_auth_session');
        try {
          sessionStorage.clear();
        } catch {
          // ignore
        }
        if (typeof window !== 'undefined') {
          window.postMessage({ type: 'FDP_PURGE_EXTENSION_STORAGE' }, '*');
        }
        authManager.logout();

        // Check if any other database is available to switch to
        const remaining = this.getAvailableNetworkDatabases().filter((d) => d.name !== msg.databaseName);
        if (remaining.length > 0) {
          const next = remaining[0];
          console.warn(`[P2P Sync] Switching to remaining database: "${next.name}"`);
          await this.switchSyncGroup(next.name);
          this.notifyData('NETWORK_SWITCH_FOLLOWED', next.name);
        } else {
          this.notifyData('NO_DATABASE_AVAILABLE');
        }
      }

      this.notifyData('AVAILABLE_DATABASES_UPDATED', this.getAvailableNetworkDatabases());
    } else if (msg.type === 'DISCOVERY_PROBE') {
      this.announceCurrentDatabase();
    }
  }

  public async announceCurrentDatabase() {
    try {
      const currentName = this.state.storeName;
      if (!currentName || currentName.trim().toLowerCase() === 'main store') {
        const org = await db.getOrganization();
        if (!org) return;
      }

      const [settings, shifts, users] = await Promise.all([
        db.getSettings(),
        db.getAllShifts(),
        db.getUsers(),
      ]);

      const name = currentName || settings.organizationName || 'Grand Hotel & Suites';
      const epoch = settings.databaseEpoch || 0;
      const databaseId = settings.databaseId || 'default';

      // Find manager if createdBy is not explicitly set in settings
      const manager = users.find((u) => u.role === 'manager');
      const createdBy = settings.createdBy || manager?.fullName || manager?.username || 'General Manager';
      const createdAt = settings.createdAt || (manager?.createdAt ? manager.createdAt : epoch ? new Date(epoch).toISOString() : new Date().toISOString());

      const entry: AvailableNetworkDatabase = {
        name,
        epoch,
        databaseId,
        peerId: this.myClientId,
        shiftsCount: shifts.length,
        usersCount: users.length,
        lastSeen: Date.now(),
        isHostedOnPeer: false,
        isActive: true,
        createdBy,
        createdAt,
      };

      this.discoveredDatabases.set(name, entry);
      this.rememberSyncGroup(name, { createdBy, createdAt });

      const packet: SyncMessage = {
        type: 'DISCOVERY_ANNOUNCE',
        databaseName: name,
        epoch,
        databaseId,
        shiftsCount: shifts.length,
        usersCount: users.length,
        peerId: this.myClientId,
        createdBy,
        createdAt,
        senderId: this.myClientId,
      };

      if (this.globalBroadcastChannel) {
        try {
          this.globalBroadcastChannel.postMessage(packet);
        } catch {
          // ignore
        }
      }

      this.discoveryConnections.forEach((conn) => {
        if (conn.open) {
          try {
            conn.send(packet);
          } catch {
            // ignore
          }
        }
      });

      this.sendToAll(packet);
      this.notifyData('AVAILABLE_DATABASES_UPDATED', this.getAvailableNetworkDatabases());
    } catch (e) {
      console.debug('Failed to announce database:', e);
    }
  }

  private pruneOldDiscoveredDatabases() {
    const now = Date.now();
    let changed = false;
    this.discoveredDatabases.forEach((entry, name) => {
      if (name !== this.state.storeName && now - entry.lastSeen > 90000) {
        this.discoveredDatabases.delete(name);
        changed = true;
      }
    });
    if (changed) {
      this.notifyData('AVAILABLE_DATABASES_UPDATED', this.getAvailableNetworkDatabases());
    }
  }

  public getAvailableNetworkDatabases(): AvailableNetworkDatabase[] {
    const list: AvailableNetworkDatabase[] = [];
    const now = Date.now();
    const seenNames = new Set<string>();

    this.discoveredDatabases.forEach((entry, name) => {
      if (entry.isActive || now - entry.lastSeen < 90000) {
        seenNames.add(name);
        list.push({
          ...entry,
          isActive: name === this.state.storeName,
        });
      }
    });

    const known = this.getKnownSyncGroups();
    for (const group of known) {
      if (!seenNames.has(group) && group.toLowerCase() !== 'main store') {
        seenNames.add(group);
        const meta = this.getSyncGroupMeta(group);
        list.push({
          name: group,
          epoch: 0,
          lastSeen: 0,
          isHostedOnPeer: false,
          isActive: group === this.state.storeName,
          createdBy: meta?.createdBy,
          createdAt: meta?.createdAt,
        });
      }
    }

    return list.sort((a, b) => {
      if (a.isActive) return -1;
      if (b.isActive) return 1;
      if (a.isHostedOnPeer && !b.isHostedOnPeer) return -1;
      if (!a.isHostedOnPeer && b.isHostedOnPeer) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  public async switchNetworkSyncGroup(targetDatabase: string, broadcastToAll: boolean = true): Promise<void> {
    const clean = targetDatabase.trim();
    if (!clean) return;

    await this.switchSyncGroup(clean);
    await this.announceCurrentDatabase();

    if (broadcastToAll) {
      const msg: SyncMessage = {
        type: 'NETWORK_SWITCH_DATABASE',
        targetDatabase: clean,
        senderId: this.myClientId,
      };

      if (this.globalBroadcastChannel) {
        try {
          this.globalBroadcastChannel.postMessage(msg);
        } catch {
          // ignore
        }
      }

      this.discoveryConnections.forEach((conn) => {
        if (conn.open) {
          try {
            conn.send(msg);
          } catch {
            // ignore
          }
        }
      });

      this.sendToAll(msg);
    }
  }

  public broadcastNetworkDatabaseDeleted(databaseName: string, purgedEpoch: number = Date.now()) {
    const clean = databaseName.trim();
    if (!clean) return;

    this.discoveredDatabases.delete(clean);
    this.removeKnownSyncGroup(clean);

    const msg: SyncMessage = {
      type: 'NETWORK_DATABASE_DELETED',
      databaseName: clean,
      purgedEpoch,
      senderId: this.myClientId,
    };

    if (this.globalBroadcastChannel) {
      try {
        this.globalBroadcastChannel.postMessage(msg);
      } catch {
        // ignore
      }
    }

    this.discoveryConnections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(msg);
        } catch {
          // ignore
        }
      }
    });

    this.sendToAll(msg);
    this.notifyData('AVAILABLE_DATABASES_UPDATED', this.getAvailableNetworkDatabases());
  }

  public async scanNetworkAndAutoSync(onNoDatabaseFound?: () => void) {
    // 1. Probe the discovery network
    const probe: SyncMessage = {
      type: 'DISCOVERY_PROBE',
      senderId: this.myClientId,
    };

    if (this.globalBroadcastChannel) {
      try {
        this.globalBroadcastChannel.postMessage(probe);
      } catch {
        // ignore
      }
    }

    this.discoveryConnections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(probe);
        } catch {
          // ignore
        }
      }
    });

    // 2. Short wait (800ms) to receive discovery announcements from peers on LAN
    await new Promise((r) => setTimeout(r, 800));

    // 3. Find any active database hosted on the network
    const onlineDatabases = Array.from(this.discoveredDatabases.values()).filter(
      (d) => d.lastSeen > Date.now() - 60000 && d.name.toLowerCase() !== 'main store'
    );

    const hasLocalUsers = await db.hasUsers();

    if (onlineDatabases.length > 0) {
      onlineDatabases.sort((a, b) => (b.epoch || 0) - (a.epoch || 0));
      const targetDb = onlineDatabases[0];

      if (this.state.storeName !== targetDb.name || !hasLocalUsers) {
        console.warn(`[P2P Sync] Auto-connecting to active network database: "${targetDb.name}"`);
        await this.switchSyncGroup(targetDb.name);
        return;
      }
    }

    // 4. If no online database found on network:
    if (!hasLocalUsers) {
      const known = this.getKnownSyncGroups().filter((g) => g.toLowerCase() !== 'main store');
      if (known.length === 0) {
        console.warn('[P2P Sync] No database available on network or locally. Triggering welcome setup.');
        onNoDatabaseFound?.();
        this.notifyData('NO_DATABASE_AVAILABLE');
        return;
      }
    }

    // 5. Connect to current or local store
    await this.autoConnect();
    await this.announceCurrentDatabase();
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

  public rememberSyncGroup(groupName: string, meta?: { createdBy?: string; createdAt?: string | number }) {
    if (!groupName || !groupName.trim()) return;
    try {
      const trimmed = groupName.trim();
      const current = this.getKnownSyncGroups();
      if (!current.includes(trimmed)) {
        current.unshift(trimmed);
      }
      localStorage.setItem('cdm_known_sync_groups', JSON.stringify(current));
      if (meta && (meta.createdBy || meta.createdAt)) {
        const existingMeta = this.getSyncGroupMeta(trimmed) || {};
        localStorage.setItem(
          `cdm_group_meta_${trimmed.toLowerCase()}`,
          JSON.stringify({
            ...existingMeta,
            ...meta,
          })
        );
      }
    } catch {
      // ignore
    }
  }

  public getSyncGroupMeta(groupName: string): { createdBy?: string; createdAt?: string | number } | null {
    try {
      const raw = localStorage.getItem(`cdm_group_meta_${groupName.trim().toLowerCase()}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
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
      const incomingEpoch = typeof msg.databaseEpoch === 'number' ? msg.databaseEpoch : (typeof msg.settings?.databaseEpoch === 'number' ? msg.settings.databaseEpoch : 0);
      const incomingDbId = msg.databaseId || msg.settings?.databaseId || 'default';
      const localSettings = await db.getSettings();
      const localEpoch = typeof localSettings.databaseEpoch === 'number' ? localSettings.databaseEpoch : 0;
      const localDbId = localSettings.databaseId || 'default';
      const lastPurgedEpoch = parseInt(localStorage.getItem('cdm_last_purged_epoch') || '0', 10);

      // 1. ABSOLUTE PURGE GUARD:
      // If a database purge or new initialization took place (lastPurgedEpoch > 0) and the incoming database has an epoch
      // that is <= lastPurgedEpoch (which includes legacy un-epoched incomingEpoch === 0 or older databases),
      // REJECT IT COMPLETELY!
      if (lastPurgedEpoch > 0 && incomingEpoch <= lastPurgedEpoch) {
        console.warn(`[P2P Sync] DROPPED OBSOLETE/PURGED DATABASE! Incoming epoch ${incomingEpoch} is <= lastPurgedEpoch ${lastPurgedEpoch}. Replying with HARD PURGE.`);
        if (relayFromPeerId) {
          const targetConn = this.connections.get(relayFromPeerId);
          if (targetConn && targetConn.open) {
            targetConn.send({
              type: 'DATABASE_HARD_PURGE',
              purgedEpoch: lastPurgedEpoch,
              senderId: this.myClientId,
            });
          }
        }
        return; // NEVER save obsolete records!
      }

      // 2. If local database has an active epoch, and incoming database is older (or legacy 0):
      if (localEpoch > 0 && incomingEpoch < localEpoch) {
        console.warn(`[P2P Sync] Incoming epoch ${incomingEpoch} is older than local ${localEpoch}. Overwriting remote peer.`);
        this.sendFullSyncToPeer(relayFromPeerId, localSettings);
        return; // NEVER save older records into a newly initialized database!
      }

      // 3. If incoming database is newer than local (e.g. peer created a new database):
      if (incomingEpoch > localEpoch) {
        console.warn(`[P2P Sync] Incoming epoch ${incomingEpoch} is newer than local ${localEpoch}. Auto-archiving local and adopting new database.`);
        try {
          const currentSyncGroup = this.state.storeName || 'Main Store';
          await db.createDatabaseArchive('Auto-Archive (Superseded DB)', currentSyncGroup);
        } catch (e) {
          console.error('Failed to auto-archive local data before adopting newer DB:', e);
        }
        await db.resetDatabaseToFactoryDefaults();
        localStorage.setItem('cdm_last_purged_epoch', String(incomingEpoch));
        localStorage.removeItem('cdm_local_active_shift_id');
        localStorage.removeItem('frontdesk_external_logs');
        if (typeof window !== 'undefined') {
          window.postMessage({ type: 'FDP_PURGE_EXTENSION_STORAGE' }, '*');
        }
      }

      // 4. If epoch matches but databaseId differs:
      if (localDbId && incomingDbId && localDbId !== incomingDbId && localDbId !== 'default' && incomingDbId !== 'default') {
        console.warn(`[P2P Sync] Database ID mismatch: local ${localDbId} vs incoming ${incomingDbId}. Retaining local authoritative database.`);
        return;
      }

      // 5. Granular Shift & Log Filtering:
      // In a freshly initialized database (not a restored archive), shifts or shift logs created BEFORE the database epoch
      // are orphaned ghosts from prior deleted databases. DROP THEM!
      const activeEpoch = Math.max(localEpoch, incomingEpoch, lastPurgedEpoch);
      const isRestored = localSettings.isRestoredArchive || msg.settings?.isRestoredArchive;

      if (msg.shifts && Array.isArray(msg.shifts)) {
        let validShifts = msg.shifts;
        if (!isRestored && activeEpoch > 0) {
          validShifts = msg.shifts.filter((s) => {
            const t = new Date(s.openTime || s.closeTime || 0).getTime();
            return t >= (activeEpoch - 10000); // 10s clock drift tolerance
          });
        }
        if (validShifts.length > 0) {
          await db.bulkSaveShifts(validShifts);
        }
      }

      if (msg.shiftLogs && Array.isArray(msg.shiftLogs)) {
        let validLogs = msg.shiftLogs;
        if (!isRestored && activeEpoch > 0) {
          validLogs = msg.shiftLogs.filter((l) => {
            const t = new Date(l.createdAt || 0).getTime();
            return t >= (activeEpoch - 10000); // 10s clock drift tolerance
          });
        }
        if (validLogs.length > 0) {
          await db.bulkSaveShiftLogs(validLogs);
        }
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
      const localSettings = await db.getSettings();
      const localEpoch = typeof localSettings.databaseEpoch === 'number' ? localSettings.databaseEpoch : 0;
      const lastPurgedEpoch = parseInt(localStorage.getItem('cdm_last_purged_epoch') || '0', 10);
      const activeEpoch = Math.max(localEpoch, lastPurgedEpoch);
      const isRestored = localSettings.isRestoredArchive;

      const shiftTime = new Date(msg.shift.openTime || msg.shift.closeTime || 0).getTime();
      if (!isRestored && activeEpoch > 0 && shiftTime > 0 && shiftTime < (activeEpoch - 10000)) {
        console.warn(`[P2P Sync] Dropped obsolete shift created before database epoch: ${msg.shift.id}`);
        return;
      }
      await db.saveShift(msg.shift);
      this.notifyData('SHIFT_UPDATED', msg.shift);
      this.relayIfHub(msg, relayFromPeerId);
    } else if (msg.type === 'SHIFT_LOG_UPSERT' && msg.log) {
      const localSettings = await db.getSettings();
      const localEpoch = typeof localSettings.databaseEpoch === 'number' ? localSettings.databaseEpoch : 0;
      const lastPurgedEpoch = parseInt(localStorage.getItem('cdm_last_purged_epoch') || '0', 10);
      const activeEpoch = Math.max(localEpoch, lastPurgedEpoch);
      const isRestored = localSettings.isRestoredArchive;

      const logTime = new Date(msg.log.createdAt || 0).getTime();
      if (!isRestored && activeEpoch > 0 && logTime > 0 && logTime < (activeEpoch - 10000)) {
        console.warn(`[P2P Sync] Dropped obsolete shift log created before database epoch: ${msg.log.id}`);
        return;
      }
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
    } else if (msg.type === 'DATABASE_HARD_PURGE' || (msg.type === 'DATABASE_ARCHIVED_AND_PURGED' && msg.archive)) {
      if (msg.archive) {
        db.saveDatabaseArchive(msg.archive);
      }
      const purgeTimestamp = msg.purgedEpoch || Date.now();
      localStorage.setItem('cdm_last_purged_epoch', String(purgeTimestamp));

      await db.resetDatabaseToFactoryDefaults();
      const groupToDelete = msg.syncGroupToDelete || (msg as { oldSyncGroup?: string }).oldSyncGroup;
      if (groupToDelete) {
        this.removeKnownSyncGroup(groupToDelete);
        const currentSaved = localStorage.getItem('cdm_store_name');
        if (currentSaved === groupToDelete) {
          localStorage.removeItem('cdm_store_name');
        }
      }
      localStorage.removeItem('cdm_local_active_shift_id');
      localStorage.removeItem('frontdesk_external_logs');
      localStorage.removeItem('cdm_session_user');
      localStorage.removeItem('frontdesk_auth_session');
      try {
        sessionStorage.clear();
      } catch {
        // ignore
      }
      if (typeof window !== 'undefined') {
        window.postMessage({ type: 'FDP_PURGE_EXTENSION_STORAGE' }, '*');
      }
      authManager.logout();
      this.notifyData('DATABASE_PURGED', msg);
      this.relayIfHub(msg, relayFromPeerId);
    } else if (msg.type === 'DATABASE_INITIALIZED' && msg.settings) {
      // 1. Snapshot any current local records to archive just in case
      try {
        const localShiftsCount = (await db.getAllShifts()).length;
        if (localShiftsCount > 0) {
          const currentSyncGroup = this.state.storeName || 'Main Store';
          await db.createDatabaseArchive('Pre-Initialization Archive', currentSyncGroup);
        }
      } catch (e) {
        console.error('Failed to auto-archive local data before adopting newly initialized DB:', e);
      }

      // 2. HARD RESET local database to factory defaults - ABSOLUTE PURGE OF OBSOLETE SHIFTS & DRAWS!
      await db.resetDatabaseToFactoryDefaults();

      // 3. Mark last purged epoch locally so obsolete incoming syncs or old peers are rejected
      const newEpoch = typeof msg.settings.databaseEpoch === 'number' ? msg.settings.databaseEpoch : Date.now();
      localStorage.setItem('cdm_last_purged_epoch', String(newEpoch));

      // 4. Clear all local drawer state and extension storage
      localStorage.removeItem('cdm_local_active_shift_id');
      localStorage.removeItem('frontdesk_external_logs');
      localStorage.removeItem('cdm_session_user');
      localStorage.removeItem('frontdesk_auth_session');
      try {
        sessionStorage.clear();
      } catch {
        // ignore
      }
      if (typeof window !== 'undefined') {
        window.postMessage({ type: 'FDP_PURGE_EXTENSION_STORAGE' }, '*');
      }

      // 5. Save the new settings, new hotel organization, and manager account
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

      // 6. Log out previous session so all drawers are cleanly zeroed
      authManager.logout();

      this.notifyData('DATABASE_INITIALIZED', msg);
      this.relayIfHub(msg, relayFromPeerId);
    } else if (msg.type === 'NETWORK_SWITCH_DATABASE') {
      if (msg.targetDatabase && msg.targetDatabase !== this.state.storeName) {
        console.warn(`[P2P Sync] Network command to switch to "${msg.targetDatabase}". Following sync...`);
        await this.switchSyncGroup(msg.targetDatabase);
        this.notifyData('NETWORK_SWITCH_FOLLOWED', msg.targetDatabase);
      }
      this.relayIfHub(msg, relayFromPeerId);
    } else if (msg.type === 'NETWORK_DATABASE_DELETED') {
      this.discoveredDatabases.delete(msg.databaseName);
      this.removeKnownSyncGroup(msg.databaseName);
      if (this.state.storeName === msg.databaseName) {
        console.warn(`[P2P Sync] Active database "${msg.databaseName}" was deleted across network.`);
        await db.resetDatabaseToFactoryDefaults();
        localStorage.removeItem('cdm_store_name');
        localStorage.removeItem('cdm_local_active_shift_id');
        localStorage.removeItem('frontdesk_external_logs');
        localStorage.removeItem('cdm_session_user');
        localStorage.removeItem('frontdesk_auth_session');
        try {
          sessionStorage.clear();
        } catch {
          // ignore
        }
        if (typeof window !== 'undefined') {
          window.postMessage({ type: 'FDP_PURGE_EXTENSION_STORAGE' }, '*');
        }
        authManager.logout();

        const remaining = this.getAvailableNetworkDatabases().filter((d) => d.name !== msg.databaseName);
        if (remaining.length > 0) {
          await this.switchSyncGroup(remaining[0].name);
          this.notifyData('NETWORK_SWITCH_FOLLOWED', remaining[0].name);
        } else {
          this.notifyData('NO_DATABASE_AVAILABLE');
        }
      }
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

  public broadcastHardPurge(archive: DatabaseArchive, syncGroupToDelete: string, purgedEpoch: number) {
    this.sendToAll({
      type: 'DATABASE_HARD_PURGE',
      archive,
      syncGroupToDelete,
      purgedEpoch,
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
