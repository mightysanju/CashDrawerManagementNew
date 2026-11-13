import Peer, { DataConnection } from 'peerjs';
import { ShiftRecord } from '../types';
import { DatabaseManager } from './database';

export type SyncMessage =
  | { type: 'FULL_SYNC'; shifts: ShiftRecord[] }
  | { type: 'SHIFT_UPSERT'; shift: ShiftRecord }
  | { type: 'HISTORY_CLEARED' }
  | { type: 'PING' };

export type SyncStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface SyncState {
  status: SyncStatus;
  myCode: string | null;
  connectedCount: number;
  errorMessage: string | null;
}

const PEER_PREFIX = 'cdm-store-';
const db = new DatabaseManager();

class P2PSyncManager {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private state: SyncState = {
    status: 'disconnected',
    myCode: null,
    connectedCount: 0,
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

  /**
   * Initializes this register as a Host with a specific or generated Store Code
   */
  public async hostNetwork(customCode?: string): Promise<string> {
    this.disconnect();
    this.updateState({ status: 'connecting', errorMessage: null });

    const rawCode = (customCode || this.generateRoomCode()).toUpperCase().trim();
    const peerId = `${PEER_PREFIX}${rawCode}`;

    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer(peerId, {
          debug: 1,
        });

        this.peer.on('open', (id) => {
          const code = id.replace(PEER_PREFIX, '');
          this.updateState({
            status: 'connected',
            myCode: code,
            connectedCount: 0,
            errorMessage: null,
          });
          resolve(code);
        });

        this.peer.on('connection', (conn) => {
          this.handleIncomingConnection(conn);
        });

        this.peer.on('error', (err) => {
          console.error('PeerJS error:', err);
          let errorMsg = 'Failed to establish peer network.';
          if (err.type === 'unavailable-id') {
            errorMsg = `Code "${rawCode}" is already in use by another active register. Please try connecting to it or use a different code.`;
          }
          this.updateState({ status: 'error', errorMessage: errorMsg });
          reject(new Error(errorMsg));
        });

        this.peer.on('disconnected', () => {
          this.updateState({ status: 'disconnected' });
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown peer initialization error';
        this.updateState({ status: 'error', errorMessage: errorMsg });
        reject(err);
      }
    });
  }

  /**
   * Connects this register to an existing Store Code running on another machine
   */
  public async joinNetwork(targetCode: string): Promise<void> {
    this.disconnect();
    this.updateState({ status: 'connecting', errorMessage: null });

    const cleanCode = targetCode.toUpperCase().trim();
    const targetPeerId = `${PEER_PREFIX}${cleanCode}`;
    const myTempId = `${PEER_PREFIX}${cleanCode}-client-${Math.floor(1000 + Math.random() * 9000)}`;

    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer(myTempId, {
          debug: 1,
        });

        this.peer.on('open', () => {
          if (!this.peer) return;

          const conn = this.peer.connect(targetPeerId, {
            reliable: true,
          });

          conn.on('open', async () => {
            this.connections.set(conn.peer, conn);
            this.setupConnectionHandlers(conn);
            this.updateState({
              status: 'connected',
              myCode: cleanCode,
              connectedCount: this.connections.size,
              errorMessage: null,
            });

            // Send initial local data to remote so both registers merge
            const allLocal = await db.getAllShifts();
            conn.send({
              type: 'FULL_SYNC',
              shifts: allLocal,
            });

            resolve();
          });

          conn.on('error', (err) => {
            console.error('Connection error:', err);
            const msg = `Could not reach register "${cleanCode}". Make sure the other computer is on and has Cash Drawer Manager open.`;
            this.updateState({ status: 'error', errorMessage: msg });
            reject(new Error(msg));
          });
        });

        this.peer.on('error', (err) => {
          console.error('Peer error:', err);
          const msg = `Could not connect to network "${cleanCode}".`;
          this.updateState({ status: 'error', errorMessage: msg });
          reject(new Error(msg));
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to join peer network';
        this.updateState({ status: 'error', errorMessage: msg });
        reject(err);
      }
    });
  }

  private handleIncomingConnection(conn: DataConnection) {
    conn.on('open', async () => {
      this.connections.set(conn.peer, conn);
      this.setupConnectionHandlers(conn);
      this.updateState({ connectedCount: this.connections.size });

      // Immediately send current local shifts to the newly joined peer
      const allLocal = await db.getAllShifts();
      conn.send({
        type: 'FULL_SYNC',
        shifts: allLocal,
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
        }
      } else if (msg.type === 'HISTORY_CLEARED') {
        await db.clearHistory();
        this.notifyData('HISTORY_CLEARED');
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

  private notifyData(action: string, data?: unknown) {
    this.dataListeners.forEach((listener) => listener(action, data));
  }

  /**
   * Broadcasts a shift upsert to all connected peer computers
   */
  public broadcastShift(shift: ShiftRecord) {
    if (this.connections.size === 0) return;
    const msg: SyncMessage = { type: 'SHIFT_UPSERT', shift };
    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send(msg);
      }
    });
  }

  /**
   * Broadcasts a history cleared event to all connected peer computers
   */
  public broadcastHistoryCleared() {
    if (this.connections.size === 0) return;
    const msg: SyncMessage = { type: 'HISTORY_CLEARED' };
    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send(msg);
      }
    });
  }

  /**
   * Disconnects from peer network
   */
  public disconnect() {
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

    this.updateState({
      status: 'disconnected',
      myCode: null,
      connectedCount: 0,
      errorMessage: null,
    });
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}

export const p2pSyncManager = new P2PSyncManager();
