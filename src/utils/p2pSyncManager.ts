import Peer, { DataConnection } from 'peerjs';
import { ShiftRecord } from '../types';
import { DatabaseManager } from './database';

export type SyncMessage =
  | { type: 'FULL_SYNC'; shifts: ShiftRecord[]; senderId?: string }
  | { type: 'SHIFT_UPSERT'; shift: ShiftRecord; senderId?: string }
  | { type: 'HISTORY_CLEARED'; senderId?: string }
  | { type: 'HEARTBEAT'; senderId?: string };

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
const BROADCAST_CHANNEL_NAME = 'cdm_lan_broadcast';
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
    this.initBroadcastChannel();
    // Load store name from localStorage if previously configured
    try {
      const saved = localStorage.getItem('cdm_store_name');
      if (saved) {
        this.state.storeName = saved;
        this.storeSlug = this.sanitizeSlug(saved);
      }
    } catch {
      // ignore
    }
  }

  /**
   * Initializes native BroadcastChannel for instant zero-latency sync across
   * tabs / windows on the same machine
   */
  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.broadcastChannel.onmessage = async (event) => {
          const msg = event.data as SyncMessage;
          if (!msg || !msg.type || msg.senderId === this.myClientId) return;

          if (msg.type === 'FULL_SYNC' && Array.isArray(msg.shifts)) {
            await db.bulkSaveShifts(msg.shifts);
            this.notifyData('SYNC_COMPLETED', msg.shifts);
          } else if (msg.type === 'SHIFT_UPSERT' && msg.shift) {
            await db.saveShift(msg.shift);
            this.notifyData('SHIFT_UPDATED', msg.shift);
          } else if (msg.type === 'HISTORY_CLEARED') {
            await db.clearHistory();
            this.notifyData('HISTORY_CLEARED');
          }
        };
      } catch (err) {
        console.debug('BroadcastChannel not available:', err);
      }
    }
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
    return clean || 'main-store';
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

    const currentStore = storeName || this.state.storeName || 'Main Store';
    this.storeSlug = this.sanitizeSlug(currentStore);
    try {
      localStorage.setItem('cdm_store_name', currentStore);
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
            const localShifts = await db.getAllShifts();
            if (conn.open) {
              conn.send({
                type: 'FULL_SYNC',
                shifts: localShifts,
                senderId: myId,
              });
            }
          } catch (e) {
            console.error('Error sending local shifts on connect:', e);
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
   * Checks both conn.open AND conn.on('open') to prevent missed events!
   */
  private handleIncomingConnection(conn: DataConnection) {
    const setupHubConn = async () => {
      this.connections.set(conn.peer, conn);
      this.setupConnectionHandlers(conn);
      this.updateState({ connectedCount: this.connections.size });

      // Automatically send the Hub's full shift history and open drawers to the joining register
      try {
        const allShifts = await db.getAllShifts();
        if (conn.open) {
          conn.send({
            type: 'FULL_SYNC',
            shifts: allShifts,
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

  private setupConnectionHandlers(conn: DataConnection) {
    conn.on('data', async (raw) => {
      const msg = raw as SyncMessage;
      if (!msg || !msg.type) return;

      if (msg.type === 'FULL_SYNC') {
        if (msg.shifts && Array.isArray(msg.shifts)) {
          await db.bulkSaveShifts(msg.shifts);
          this.notifyData('SYNC_COMPLETED', msg.shifts);
        }
      } else if (msg.type === 'SHIFT_UPSERT') {
        if (msg.shift) {
          await db.saveShift(msg.shift);
          this.notifyData('SHIFT_UPDATED', msg.shift);

          // If this machine is the Hub, relay the update to all OTHER connected registers
          if (this.state.role === 'hub') {
            this.connections.forEach((otherConn) => {
              if (otherConn.peer !== conn.peer && otherConn.open) {
                otherConn.send(msg);
              }
            });
          }
        }
      } else if (msg.type === 'HISTORY_CLEARED') {
        await db.clearHistory();
        this.notifyData('HISTORY_CLEARED');

        if (this.state.role === 'hub') {
          this.connections.forEach((otherConn) => {
            if (otherConn.peer !== conn.peer && otherConn.open) {
              otherConn.send(msg);
            }
          });
        }
      } else if (msg.type === 'HEARTBEAT') {
        // Keep-alive received
      }
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
    this.dataListeners.forEach((listener) => listener(action, data));
  }

  /**
   * Broadcasts a shift upsert to both BroadcastChannel (local windows)
   * and WebRTC DataChannels (remote computers on LAN)
   */
  public broadcastShift(shift: ShiftRecord) {
    const msg: SyncMessage = {
      type: 'SHIFT_UPSERT',
      shift,
      senderId: this.myClientId,
    };

    // 1. Send via local BroadcastChannel (instant for other tabs/windows)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(msg);
      } catch {
        // ignore
      }
    }

    // 2. Send via WebRTC DataChannels to other physical machines
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

  /**
   * Broadcasts history cleared across all channels
   */
  public broadcastHistoryCleared() {
    const msg: SyncMessage = {
      type: 'HISTORY_CLEARED',
      senderId: this.myClientId,
    };

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(msg);
      } catch {
        // ignore
      }
    }

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
