import Peer, { DataConnection } from 'peerjs';
import { ShiftRecord } from '../types';
import { DatabaseManager } from './database';

export type SyncMessage =
  | { type: 'FULL_SYNC'; shifts: ShiftRecord[]; senderId?: string }
  | { type: 'SHIFT_UPSERT'; shift: ShiftRecord; senderId?: string }
  | { type: 'HISTORY_CLEARED'; senderId?: string }
  | { type: 'PING' };

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

const PEER_PREFIX = 'cdm-v2-';
const db = new DatabaseManager();

class P2PSyncManager {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private storeSlug: string = 'main-store';
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isAutoConnecting: boolean = false;

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
   * 1. Tries to claim Hub role.
   * 2. If Hub is already running on another computer, automatically connects to it as a Client!
   */
  public async autoConnect(storeName?: string) {
    if (this.isAutoConnecting) return;
    this.isAutoConnecting = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const currentStore = storeName || this.state.storeName || 'Main Store';
    this.storeSlug = this.sanitizeSlug(currentStore);

    this.updateState({
      status: 'scanning',
      storeName: currentStore,
      errorMessage: null,
    });

    const hubId = this.getHubPeerId(this.storeSlug);

    // Step 1: Try to bind as the Hub for this store
    try {
      await this.tryHostHub(hubId);
      this.isAutoConnecting = false;
    } catch {
      // Step 2: Hub already exists! Connect to it as a client peer
      try {
        await this.connectAsClient(hubId);
      } catch (clientErr) {
        console.warn('Auto-connect client attempt failed, will retry:', clientErr);
        this.scheduleReconnect();
      } finally {
        this.isAutoConnecting = false;
      }
    }
  }

  /**
   * Tries to become the Primary Hub
   */
  private tryHostHub(hubId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.cleanupPeer();

      const peer = new Peer(hubId, { debug: 1 });
      let hasResolved = false;

      peer.on('open', (id) => {
        hasResolved = true;
        this.peer = peer;
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
        if (!hasResolved) {
          peer.destroy();
          reject(err);
        } else {
          console.error('Hub error after open:', err);
          this.updateState({ errorMessage: err.message });
        }
      });
    });
  }

  /**
   * Connects to the existing Primary Hub
   */
  private connectAsClient(hubId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.cleanupPeer();

      const clientId = this.getClientPeerId(this.storeSlug);
      const peer = new Peer(clientId, { debug: 1 });
      let hasResolved = false;

      peer.on('open', (myId) => {
        this.peer = peer;

        const conn = peer.connect(hubId, { reliable: true });

        conn.on('open', async () => {
          hasResolved = true;
          this.connections.set(conn.peer, conn);
          this.setupConnectionHandlers(conn);

          this.updateState({
            status: 'connected',
            role: 'client',
            myPeerId: myId,
            connectedCount: 1,
            errorMessage: null,
          });

          // Send our local shifts to the hub to ensure two-way sync
          const localShifts = await db.getAllShifts();
          conn.send({
            type: 'FULL_SYNC',
            shifts: localShifts,
            senderId: myId,
          });

          resolve();
        });

        conn.on('error', (err) => {
          if (!hasResolved) {
            peer.destroy();
            reject(err);
          }
        });

        conn.on('close', () => {
          console.log('Connection to Hub closed. Initiating failover/re-scan...');
          this.connections.delete(conn.peer);
          this.updateState({
            status: 'disconnected',
            connectedCount: 0,
          });
          this.scheduleReconnect();
        });
      });

      peer.on('error', (err) => {
        if (!hasResolved) {
          peer.destroy();
          reject(err);
        }
      });
    });
  }

  private handleIncomingConnection(conn: DataConnection) {
    conn.on('open', async () => {
      this.connections.set(conn.peer, conn);
      this.setupConnectionHandlers(conn);
      this.updateState({ connectedCount: this.connections.size });

      // Automatically send the Hub's shift database to the newly connected register
      const allShifts = await db.getAllShifts();
      conn.send({
        type: 'FULL_SYNC',
        shifts: allShifts,
        senderId: this.peer?.id,
      });
    });
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

          // If this machine is the Hub, forward the update to all OTHER connected registers!
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

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.autoConnect(this.state.storeName);
    }, 3000);
  }

  private notifyData(action: string, data?: unknown) {
    this.dataListeners.forEach((listener) => listener(action, data));
  }

  /**
   * Broadcasts a shift upsert to all active peer connections
   */
  public broadcastShift(shift: ShiftRecord) {
    if (this.connections.size === 0) return;
    const msg: SyncMessage = { 
      type: 'SHIFT_UPSERT', 
      shift, 
      senderId: this.peer?.id 
    };
    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send(msg);
      }
    });
  }

  /**
   * Broadcasts history cleared
   */
  public broadcastHistoryCleared() {
    if (this.connections.size === 0) return;
    const msg: SyncMessage = { 
      type: 'HISTORY_CLEARED', 
      senderId: this.peer?.id 
    };
    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send(msg);
      }
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
