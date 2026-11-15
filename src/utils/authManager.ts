import { UserAccount } from '../types';
import { DatabaseManager } from './database';

const SESSION_KEY = 'cdm_session_user';
const db = new DatabaseManager();

type AuthListener = (user: UserAccount | null) => void;

class AuthManager {
  private currentUser: UserAccount | null = null;
  private listeners: Set<AuthListener> = new Set();

  constructor() {
    this.loadSession();
  }

  private loadSession() {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        this.currentUser = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse auth session:', e);
      this.currentUser = null;
    }
  }

  public getCurrentUser(): UserAccount | null {
    return this.currentUser;
  }

  public isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  public isManager(): boolean {
    return this.currentUser?.role === 'manager';
  }

  public subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    listener(this.currentUser);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentUser);
      } catch (e) {
        console.error('Error in auth listener:', e);
      }
    });

    if (typeof window !== 'undefined') {
      try {
        // Cross-world postMessage (reaches Chrome extension content scripts reliably)
        window.postMessage({ type: 'FDP_APP_USER_SYNC', user: this.currentUser }, '*');
        window.dispatchEvent(
          new CustomEvent('FDP_APP_USER_SYNC', {
            detail: this.currentUser,
          })
        );
        document.dispatchEvent(
          new CustomEvent('FDP_APP_USER_SYNC', {
            detail: this.currentUser,
          })
        );
      } catch {
        // ignore
      }
    }
  }

  public async login(username: string, passwordPlain: string): Promise<{ success: boolean; error?: string; user?: UserAccount }> {
    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser || !passwordPlain) {
      return { success: false, error: 'Please enter both username and password.' };
    }

    try {
      let user = await db.getUserByUsername(cleanUser);
      if (!user) {
        // Quick 300ms retry in case an incoming P2P user sync is currently writing
        await new Promise((r) => setTimeout(r, 300));
        user = await db.getUserByUsername(cleanUser);
      }

      if (!user) {
        return { success: false, error: 'Invalid username or password.' };
      }

      if (!user.isActive) {
        return { success: false, error: 'This user account has been deactivated. Please contact your manager.' };
      }

      // Check password (supports plain or hashed)
      if (user.passwordHash !== passwordPlain) {
        return { success: false, error: 'Invalid username or password.' };
      }

      this.currentUser = user;
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      } catch (err) {
        console.warn('Failed to save session to localStorage:', err);
      }
      this.notify();
      return { success: true, user };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: 'An error occurred during authentication.' };
    }
  }

  public updateCurrentUser(user: UserAccount) {
    this.currentUser = user;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } catch (err) {
      console.warn('Failed to update session in localStorage:', err);
    }
    this.notify();
  }

  public logout() {
    this.currentUser = null;
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
    this.notify();
  }
}

export const authManager = new AuthManager();
