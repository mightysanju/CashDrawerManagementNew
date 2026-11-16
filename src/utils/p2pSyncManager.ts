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
import { authManager } from './authManager';

export type SyncStage = 'connecting' | 'connection_established' | 'in_sync';

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: string;
}

export interface ConnectedStationInfo {
  deviceId: string;
  peerId: string;
  stationName: string;
  deviceTag: string;
  platform: string;
  browser: string;
  loggedInUser?: {
    id: string;
    fullName: string;
    username: string;
    role: string;
  } | null;
  databaseName: string;
  databaseEpoch?: number;
  isPrimaryHub: boolean;
  syncStage: SyncStage;
  lastSeen: number;
  isThisDevice: boolean;
}

export function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem('cdm_device_id');
    if (!id || id.length < 4) {
      const randHex = Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1).toUpperCase();
      id = `DESKTOP-${randHex}`;
      localStorage.setItem('cdm_device_id', id);
    }
    return id;
  } catch {
    return 'DESKTOP-1000';
  }
}

export function detectPlatformAndBrowser(): { platform: string; browser: string } {
  if (typeof navigator === 'undefined') {
    return { platform: 'Unknown', browser: 'Browser' };
  }
  const ua = navigator.userAgent;
  let platform = 'PC';
  if (/Windows/i.test(ua)) platform = 'Windows';
  else if (/Macintosh|Mac OS/i.test(ua)) platform = 'macOS';
  else if (/CrOS/i.test(ua)) platform = 'ChromeOS';
  else if (/Linux/i.test(ua)) platform = 'Linux';
  else if (/iPad|iPhone|iPod/i.test(ua)) platform = 'iOS';
  else if (/Android/i.test(ua)) platform = 'Android';

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';

  return { platform, browser };
}

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
    }
  | {
      type: 'STATION_PRESENCE';
      station: ConnectedStationInfo;
      allStations?: ConnectedStationInfo[];
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
const DISCOVERY_BEACON_IDS = [
  'cdm-lan-v3-beacon-hub',
  'cdm-lan-v3-beacon-alt',
  'cdm-lan-v3-beacon-node',
];
const DISCOVERY_CLIENT_PREFIX = 'cdm-lan-v3-beacon-client-';

const db = new DatabaseManager();

// STUN & TURN servers for reliable local LAN, Wi-Fi NAT traversal, and AP Isolation bypass
const STUN_CONFIG = {
  iceServers: [
    // Fast Google STUN for direct local P2P connection
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    // TURN relay fallback (bypasses hotel AP Client Isolation and strict Windows firewalls)
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelay',
      credential: 'openrelay',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelay',
      credential: 'openrelay',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelay',
      credential: 'openrelay',
    },
  ],
};

class P2PSyncManager {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private broadcastChannel: BroadcastChannel | null = null;
  private storeSlug: string = 'main-store';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts: number = 0;
  private lastReconnectAttempt: number = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private isConnecting: boolean = false;
  private connectingSince: number = 0;
  private myClientId: string = '';
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;

  // Connected Stations & Live User Presence
  private myDeviceId: string = getOrCreateDeviceId();
  private connectedStations: Map<string, ConnectedStationInfo> = new Map();
  private mySyncStage: SyncStage = 'connecting';
  private customStationName: string = '';

  // Connection Diagnostics & Live Error Logs
  private syncLogs: SyncLogEntry[] = [];
  private readonly MAX_LOGS = 60;

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
      const saved = localStorage.getItem('cdm_synced_register') || localStorage.getItem('cdm_store_name');
      if (saved && saved.trim() && saved.trim().toLowerCase() !== 'main store') {
        this.state.storeName = saved.trim();
        this.storeSlug = this.sanitizeSlug(saved.trim());
      }
    } catch {
      // ignore
    }
    this.initBroadcastChannel();
    this.initGlobalDiscovery();
    this.startWatchdog();

    // Broadcast station presence whenever current user logs in or out
    try {
      authManager.subscribe(() => {
        this.broadcastStationPresence();
      });
    } catch {
      // ignore
    }
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
    if (this.discoveryPeer && !this.discoveryPeer.destroyed) return;

    let connected = false;
    for (const beaconId of DISCOVERY_BEACON_IDS) {
      try {
        await this.tryHostDiscoveryHub(beaconId);
        connected = true;
        break;
      } catch {
        try {
          await this.connectAsDiscoveryClient(beaconId);
          connected = true;
          break;
        } catch {
          // Beacon occupied but unresponsive; try next beacon in pool
          continue;
        }
      }
    }

    if (!connected) {
      this.scheduleDiscoveryReconnect();
    }

    if (this.discoveryHeartbeatTimer) clearInterval(this.discoveryHeartbeatTimer);
    this.discoveryHeartbeatTimer = setInterval(() => {
      this.announceCurrentDatabase();
      this.pruneOldDiscoveredDatabases();
    }, 8000);
  }

  private tryHostDiscoveryHub(beaconId: string = DISCOVERY_BEACON_IDS[0]): Promise<void> {
    return new Promise((resolve, reject) => {
      let peer: Peer;
      try {
        peer = new Peer(beaconId, {
          config: STUN_CONFIG,
          debug: 1,
        });
      } catch (e) {
        reject(e);
        return;
      }

      let settled = false;
      setTimeout(() => {
        if (!settled) {
          settled = true;
          try {
            peer.destroy();
          } catch {
            // ignore
          }
          reject(new Error(`Discovery hub claim timeout for ${beaconId}`));
        }
      }, 7000);

      peer.on('open', (id) => {
        if (settled) {
          try { peer.destroy(); } catch { /* ignore */ }
          return;
        }
        settled = true;
        this.discoveryPeer = peer;
        this.discoveryClientId = id;
        this.isDiscoveryHub = true;
        this.addLog('info', `Discovery beacon active (${beaconId}) - announcing & collecting hotel databases on LAN.`);

        peer.on('connection', (conn) => {
          this.discoveryConnections.set(conn.peer, conn);

          const sendRegistry = () => {
            try {
              conn.send({
                type: 'DISCOVERY_REGISTRY_SYNC',
                databases: this.getAvailableNetworkDatabases(),
                senderId: this.myClientId,
              });
            } catch {
              // ignore
            }
          };

          if (conn.open) {
            sendRegistry();
          } else {
            conn.on('open', sendRegistry);
          }

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

  private connectAsDiscoveryClient(beaconId: string = DISCOVERY_BEACON_IDS[0]): Promise<void> {
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
          reject(new Error(`Discovery hub connection timed out for ${beaconId}`));
        }
      }, 5000);

      peer.on('open', (myId) => {
        this.discoveryPeer = peer;
        this.discoveryClientId = myId;
        this.isDiscoveryHub = false;

        const conn = peer.connect(beaconId, { reliable: true });

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

          // Immediately announce our database & request registry
          this.announceCurrentDatabase();
          try {
            conn.send({
              type: 'DISCOVERY_PROBE',
              senderId: this.myClientId,
            });
          } catch {
            // ignore
          }
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
      // NOTE: no silent auto-adoption here. Unconfigured stations are shown the list of
      // discovered databases and the user chooses: Connect & Sync, or Create Account.
    } else if (msg.type === 'DISCOVERY_REGISTRY_SYNC' && Array.isArray(msg.databases)) {
      for (const d of msg.databases) {
        if (d && d.name) {
          this.rememberSyncGroup(d.name, { createdBy: d.createdBy, createdAt: d.createdAt });
          const isRemote = d.peerId !== this.myClientId;
          this.discoveredDatabases.set(d.name, {
            ...d,
            lastSeen: d.lastSeen > 0 ? Date.now() : 0,
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

    // 2. Poll up to ~7s (re-probing every 1.5s) so slow signaling/Wi-Fi doesn't look like "no database"
    const findOnline = () =>
      Array.from(this.discoveredDatabases.values()).filter(
        (d) => d.lastSeen > Date.now() - 60000 && d.name.toLowerCase() !== 'main store'
      );
    for (let i = 0; i < 14 && findOnline().length === 0; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (i > 0 && i % 3 === 0) {
        try { this.globalBroadcastChannel?.postMessage(probe); } catch { /* ignore */ }
        this.discoveryConnections.forEach((conn) => {
          if (conn.open) {
            try { conn.send(probe); } catch { /* ignore */ }
          }
        });
      }
    }

    // 3. Any active database hosted on the network
    const onlineDatabases = findOnline();

    const hasLocalUsers = await db.hasUsers();

    // Fresh/unconfigured station: DO NOT silently join. Let the user choose from the list
    // (Connect & Sync) or create a new account.
    if (!hasLocalUsers) {
      if (onlineDatabases.length > 0) {
        this.addLog('info', `Found ${onlineDatabases.length} database(s) on the network. Waiting for user to choose.`);
        this.notifyData('AVAILABLE_DATABASES_UPDATED', this.getAvailableNetworkDatabases());
        return;
      }
      const known = this.getKnownSyncGroups().filter((g) => g.toLowerCase() !== 'main store');
      if (known.length === 0) {
        this.addLog('warn', 'No database found on the network after scanning. Offering to create a new account.');
        onNoDatabaseFound?.();
        this.notifyData('NO_DATABASE_AVAILABLE');
        return;
      }
    }

    // 4. Configured station: reconnect to its remembered / current store
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

  public addLog(level: 'info' | 'warn' | 'error' | 'success', message: string, details?: string) {
    const now = new Date();
    const timestamp = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
    const entry: SyncLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp,
      level,
      message,
      details,
    };
    this.syncLogs.unshift(entry);
    if (this.syncLogs.length > this.MAX_LOGS) {
      this.syncLogs.pop();
    }
    this.notifyData('SYNC_LOGS_UPDATED', this.syncLogs);
  }

  public getSyncLogs(): SyncLogEntry[] {
    return [...this.syncLogs];
  }

  public clearSyncLogs() {
    this.syncLogs = [];
    this.notifyData('SYNC_LOGS_UPDATED', this.syncLogs);
  }

  public getMyStationInfo(): ConnectedStationInfo {
    const { platform, browser } = detectPlatformAndBrowser();
    const deviceId = this.myDeviceId;
    let name = this.customStationName;
    if (!name) {
      try {
        name = localStorage.getItem('cdm_station_name') || '';
      } catch {
        // ignore
      }
    }
    // If name is unset or contains legacy generic 'Register #...', replace with unique Device Tag
    if (!name || name.startsWith('Register #')) {
      const isHub = this.state.role === 'hub';
      name = isHub 
        ? `${deviceId} - Hub (${platform}/${browser})` 
        : `${deviceId} (${platform}/${browser})`;
      try {
        localStorage.setItem('cdm_station_name', name);
      } catch {
        // ignore
      }
    }
    this.customStationName = name;

    let user = null;
    try {
      user = authManager.getCurrentUser();
    } catch {
      // ignore
    }

    return {
      deviceId,
      peerId: this.myClientId || 'local-station',
      stationName: name,
      deviceTag: deviceId,
      platform,
      browser,
      loggedInUser: user ? {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        role: user.role,
      } : null,
      databaseName: this.state.storeName,
      isPrimaryHub: this.state.role === 'hub',
      syncStage: this.mySyncStage,
      lastSeen: Date.now(),
      isThisDevice: true,
    };
  }

  public setStationName(name: string) {
    const clean = name.trim();
    if (!clean) return;
    this.customStationName = clean;
    try {
      localStorage.setItem('cdm_station_name', clean);
    } catch {
      // ignore
    }
    this.addLog('info', `Station name updated to "${clean}"`);
    this.broadcastStationPresence();
    this.notifyData('STATION_PRESENCE_UPDATED', this.getConnectedStations());
  }

  public getConnectedStations(): ConnectedStationInfo[] {
    const myStation = this.getMyStationInfo();
    const stations: ConnectedStationInfo[] = [myStation];
    const now = Date.now();
    const seenDeviceIds = new Set<string>([myStation.deviceId]);

    this.connectedStations.forEach((st, key) => {
      const devId = st.deviceId || key;
      // Deduplicate strictly by deviceId, exclude this machine, and prune if inactive > 25 seconds
      if (devId && devId !== this.myDeviceId && !seenDeviceIds.has(devId) && (now - st.lastSeen < 25000)) {
        seenDeviceIds.add(devId);
        stations.push({
          ...st,
          isThisDevice: false,
        });
      } else if (now - st.lastSeen >= 25000) {
        this.connectedStations.delete(key);
      }
    });

    return stations;
  }

  public broadcastStationPresence(stage?: SyncStage) {
    if (stage) {
      this.mySyncStage = stage;
    }
    const myStation = this.getMyStationInfo();
    const packet: SyncMessage = {
      type: 'STATION_PRESENCE',
      station: myStation,
      allStations: this.state.role === 'hub' ? this.getConnectedStations() : undefined,
      senderId: this.myClientId,
    };
    this.sendToAll(packet);
    this.notifyData('STATION_PRESENCE_UPDATED', this.getConnectedStations());
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
    // Self-heal: a stuck connection attempt must never block reconnects for more than 45s
    if (this.isConnecting && Date.now() - this.connectingSince < 45000) return;
    this.isConnecting = true;
    this.connectingSince = Date.now();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    let currentStore = storeName;
    if (!currentStore) {
      try {
        const saved = localStorage.getItem('cdm_synced_register') || localStorage.getItem('cdm_store_name');
        if (saved && saved.trim() && saved.trim().toLowerCase() !== 'main store') {
          currentStore = saved.trim();
        } else {
          const org = await db.getOrganization();
          if (org && typeof org === 'string' && org.trim()) {
            currentStore = org.trim();
          } else if (org && typeof org === 'object' && (org as { name?: string }).name) {
            currentStore = (org as { name?: string }).name!.trim();
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
      localStorage.setItem('cdm_synced_register', currentStore);
      this.rememberSyncGroup(currentStore);
    } catch {
      // ignore
    }

    this.updateState({
      status: 'scanning',
      storeName: currentStore,
      errorMessage: null,
    });

    this.addLog('info', `Connecting to register group "${currentStore}" (Device ID: ${this.myDeviceId})...`);

    const hubId = this.getHubPeerId(this.storeSlug);

    try {
      // Step 1: Try to claim the Hub role
      await this.tryHostHub(hubId);
      this.reconnectAttempts = 0;
    } catch {
      // Step 2: Hub exists! Connect as Client
      try {
        await this.connectAsClient(hubId);
        this.reconnectAttempts = 0;
      } catch (err: unknown) {
        console.debug('Client connection attempt failed, operating in standalone in-sync mode:', err);
        const errMsg = err instanceof Error ? err.message : String(err);
        this.addLog('info', `Station ready in local in-sync mode (${errMsg}). Background search for peers active.`);
        this.mySyncStage = 'in_sync';
        this.updateState({
          status: 'connected',
          role: 'standalone',
          connectedCount: 0,
          errorMessage: null,
        });
        this.broadcastStationPresence('in_sync');
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
    if (this.peer && !this.peer.destroyed && this.peer.id === hubId && this.state.role === 'hub') {
      this.mySyncStage = 'in_sync';
      this.updateState({
        status: 'connected',
        role: 'hub',
        myPeerId: hubId,
        errorMessage: null,
      });
      this.broadcastStationPresence('in_sync');
      return Promise.resolve();
    }

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
      // Never hang forever if the signaling server is slow/unreachable
      setTimeout(() => {
        if (!settled) {
          settled = true;
          try {
            peer.destroy();
          } catch {
            // ignore
          }
          this.addLog('warn', 'Hub claim timed out after 8s. Trying client mode...');
          reject(new Error('Hub claim timeout'));
        }
      }, 8000);

      peer.on('open', (id) => {
        if (settled) {
          try { peer.destroy(); } catch { /* ignore */ }
          return;
        }
        settled = true;
        this.peer = peer;
        this.myClientId = id;
        this.mySyncStage = 'in_sync';
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

        this.addLog('success', `Active as Primary Hotel Hub (${id})`);
        this.broadcastStationPresence('in_sync');
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
          this.addLog('info', `Hub active on another PC (${err.type || 'occupied'}). Connecting as register client...`);
          reject(err);
        } else {
          this.addLog('warn', `Hub notice: ${err.type || err.message || err}`);
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
          this.addLog('warn', `Connection to Hub ${hubId} timed out after 20s. Hub might be offline or negotiating ICE.`);
          reject(new Error('Connection timeout to hub'));
        }
      }, 20000);

      peer.on('open', (myId) => {
        this.peer = peer;
        this.myClientId = myId;
        this.addLog('info', `Register client started (${myId}). Connecting to Hub: ${hubId}...`);

        const conn = peer.connect(hubId, { reliable: true });

        const setupClient = async () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);

          this.connections.set(conn.peer, conn);
          this.setupConnectionHandlers(conn);

          // Initial handshake: Connection Established
          this.mySyncStage = 'connection_established';
          this.addLog('info', `WebRTC connection opened with Hub (${conn.peer}). Status: Connection Established.`);
          this.broadcastStationPresence('connection_established');

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
            this.addLog('error', `Connection error with Hub (${conn.peer}): ${err?.message || err}`);
            reject(err);
          }
        });

        conn.on('close', () => {
          this.connections.delete(conn.peer);
          this.connectedStations.forEach((st, devId) => {
            if (st.peerId === conn.peer) {
              this.connectedStations.delete(devId);
            }
          });
          this.addLog('warn', `Connection to Hub closed (${conn.peer}). Auto-reconnecting in background...`);
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
          this.addLog('error', `Peer client error (${err?.type || 'network_error'}): ${err?.message || err}`);
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

      this.addLog('info', `New register node connected (${conn.peer}). Exchanging presence & sync payload...`);

      // Send Hub station info + all connected stations
      if (conn.open) {
        conn.send({
          type: 'STATION_PRESENCE',
          station: this.getMyStationInfo(),
          allStations: this.getConnectedStations(),
          senderId: this.myClientId,
        });
      }

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
      const localSettings = await db.getSettings();
      const localEpoch = typeof localSettings.databaseEpoch === 'number' ? localSettings.databaseEpoch : 0;
      const lastPurgedEpoch = parseInt(localStorage.getItem('cdm_last_purged_epoch') || '0', 10);

      // 1. ABSOLUTE PURGE GUARD:
      // If a database purge took place (lastPurgedEpoch > 0) and the incoming database has an epoch
      // that is strictly older than lastPurgedEpoch (which includes legacy un-epoched incomingEpoch === 0 or older databases),
      // REJECT IT!
      if (lastPurgedEpoch > 0 && incomingEpoch < lastPurgedEpoch) {
        console.warn(`[P2P Sync] DROPPED OBSOLETE/PURGED DATABASE! Incoming epoch ${incomingEpoch} is < lastPurgedEpoch ${lastPurgedEpoch}. Replying with HARD PURGE.`);
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
      this.mySyncStage = 'in_sync';
      if (relayFromPeerId) {
        const existing = this.connectedStations.get(relayFromPeerId);
        if (existing) {
          existing.syncStage = 'in_sync';
          existing.lastSeen = Date.now();
        }
      }
      this.addLog('success', `Database synchronized! (${msg.shifts?.length || 0} shifts, ${msg.users?.length || 0} staff accounts)`);
      this.broadcastStationPresence('in_sync');
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
    } else if (msg.type === 'STATION_PRESENCE' && msg.station) {
      const devId = msg.station.deviceId || msg.station.peerId || msg.senderId;
      if (devId && devId !== this.myDeviceId && devId !== this.myClientId) {
        this.connectedStations.set(devId, {
          ...msg.station,
          deviceId: devId,
          isThisDevice: false,
          lastSeen: Date.now(),
        });
      }
      if (Array.isArray(msg.allStations)) {
        for (const st of msg.allStations) {
          const remoteDevId = st?.deviceId || st?.peerId;
          if (remoteDevId && remoteDevId !== this.myDeviceId && remoteDevId !== this.myClientId) {
            this.connectedStations.set(remoteDevId, {
              ...st,
              deviceId: remoteDevId,
              isThisDevice: false,
              lastSeen: Date.now(),
            });
          }
        }
      }
      this.relayIfHub(msg, relayFromPeerId);
      this.notifyData('STATION_PRESENCE_UPDATED', this.getConnectedStations());
    }
  }

  private relayIfHub(msg: SyncMessage, excludePeerId?: string) {
    if (this.state.role === 'hub') {
      this.connections.forEach((otherConn) => {
        if (otherConn.peer !== excludePeerId && otherConn.open) {
          try {
            otherConn.send(msg);
          } catch (e) {
            console.warn(`[P2P Sync] Error relaying frame (${msg.type}) to peer ${otherConn.peer}:`, e);
          }
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
      this.connectedStations.forEach((st, devId) => {
        if (st.peerId === conn.peer) {
          this.connectedStations.delete(devId);
        }
      });
      this.addLog('warn', `Connection closed with peer register (${conn.peer})`);
      this.notifyData('STATION_PRESENCE_UPDATED', this.getConnectedStations());
      this.updateState({ connectedCount: this.connections.size });
      if (this.state.role === 'client') {
        this.updateState({ status: 'disconnected' });
        const remembered = localStorage.getItem('cdm_synced_register') || this.state.storeName;
        this.scheduleReconnect(remembered);
      }
    });

    conn.on('error', (err) => {
      this.connections.delete(conn.peer);
      this.connectedStations.forEach((st, devId) => {
        if (st.peerId === conn.peer) {
          this.connectedStations.delete(devId);
        }
      });
      this.addLog('error', `Connection error with peer register (${conn.peer}): ${err?.message || err}`);
      this.notifyData('STATION_PRESENCE_UPDATED', this.getConnectedStations());
      this.updateState({ connectedCount: this.connections.size });
      if (this.state.role === 'client') {
        this.updateState({ status: 'disconnected' });
        const remembered = localStorage.getItem('cdm_synced_register') || this.state.storeName;
        this.scheduleReconnect(remembered);
      }
    });
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(async () => {
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

        // Broadcast current station presence + active user every heartbeat
        this.broadcastStationPresence();

        // Periodic reconciliation: Hub shares latest users and shifts to prevent drift
        if (this.state.role === 'hub') {
          try {
            const [users, shifts, settings] = await Promise.all([
              db.getUsers(),
              db.getAllShifts(),
              db.getSettings(),
            ]);
            this.sendToAll({
              type: 'FULL_SYNC',
              shifts,
              users,
              settings,
              databaseEpoch: settings.databaseEpoch || 0,
              databaseId: settings.databaseId || 'default',
              senderId: this.myClientId,
            });
          } catch {
            // ignore
          }
        }
      }
    }, 10000);
  }

  private startWatchdog() {
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    this.watchdogTimer = setInterval(async () => {
      if (typeof window === 'undefined') return;
      if (localStorage.getItem('cdm_sync_paused') === 'true') return;

      const rememberedStore = localStorage.getItem('cdm_synced_register') || localStorage.getItem('cdm_store_name');
      if (!rememberedStore || rememberedStore.trim().toLowerCase() === 'main store') return;

      // Never race an active reconnect timer or in-progress handshake
      if (this.reconnectTimer || this.isConnecting) return;
      if (Date.now() - this.lastReconnectAttempt < 10000) return;

      const isClientAndOrphan = this.state.role === 'client' && this.connections.size === 0;
      const isDisconnected = this.state.status === 'disconnected';
      const isPeerDown = !this.peer || this.peer.destroyed;

      if (isClientAndOrphan || isDisconnected || isPeerDown) {
        this.lastReconnectAttempt = Date.now();
        console.debug(`[P2P Sync Watchdog] Reconnecting to remembered register: "${rememberedStore}"...`);
        this.addLog('info', `Background watchdog checking hotel network for "${rememberedStore}"...`);
        this.autoConnect(rememberedStore);
      } else if (this.peer && this.peer.disconnected && !this.peer.destroyed) {
        try {
          this.peer.reconnect();
        } catch {
          // ignore
        }
      }
    }, 12000);
  }

  private scheduleReconnect(storeName: string) {
    if (this.reconnectTimer) return;
    this.reconnectAttempts++;
    const delay = Math.min(25000, 4000 * Math.pow(1.3, Math.min(this.reconnectAttempts, 5)));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.lastReconnectAttempt = Date.now();
      this.autoConnect(storeName);
    }, delay);
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

  public broadcastDeleteShiftLog(logId: string) {
    this.broadcastShiftLogDelete(logId);
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
    this.connectedStations.clear();
    this.mySyncStage = 'connecting';

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
