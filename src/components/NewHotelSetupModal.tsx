import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  User, 
  Key, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  Wifi,
  WifiOff,
  RefreshCw,
  Radio,
  PlusCircle,
  Download,
  Clock
} from 'lucide-react';
import { DatabaseManager } from '../utils/database';
import { authManager } from '../utils/authManager';
import { p2pSyncManager, AvailableNetworkDatabase } from '../utils/p2pSyncManager';
import { UserAccount, AppSettings } from '../types';

interface NewHotelSetupModalProps {
  isOpen: boolean;
  onSetupComplete: (manager?: UserAccount) => void;
}

const db = new DatabaseManager();

const formatCreatedTime = (timestamp?: string | number) => {
  if (!timestamp) return null;
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
};

export const NewHotelSetupModal: React.FC<NewHotelSetupModalProps> = ({
  isOpen,
  onSetupComplete,
}) => {
  const [activeTab, setActiveTab] = useState<'sync' | 'create'>('sync');
  const userSelectedTabRef = useRef(false);
  const [availableDbs, setAvailableDbs] = useState<AvailableNetworkDatabase[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [syncingDbName, setSyncingDbName] = useState<string | null>(null);

  // Form states for Option 2 (Create Account)
  const [propertyName, setPropertyName] = useState('Grand Hotel & Suites');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('manager');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load and subscribe to network-discovered databases
  useEffect(() => {
    if (!isOpen) {
      userSelectedTabRef.current = false;
      return;
    }

    const refreshDatabases = () => {
      const dbs = p2pSyncManager.getAvailableNetworkDatabases().filter(
        (d) => d.name.toLowerCase() !== 'main store'
      );
      setAvailableDbs(dbs);

      // ONLY set default tab on initial load if user hasn't clicked/typed in a tab yet
      if (!userSelectedTabRef.current) {
        if (dbs.length > 0) {
          setActiveTab('sync');
        } else {
          setActiveTab('create');
        }
      }
    };

    refreshDatabases();

    // Trigger an active probe on mount
    setIsScanning(true);
    p2pSyncManager.scanNetworkAndAutoSync().finally(() => {
      refreshDatabases();
      setIsScanning(false);
    });

    const unsubData = p2pSyncManager.subscribeData((action) => {
      if (action === 'AVAILABLE_DATABASES_UPDATED' || action === 'DISCOVERY_REGISTRY_SYNC') {
        refreshDatabases();
      }
    });

    return () => unsubData();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRescan = async () => {
    setIsScanning(true);
    setError(null);
    try {
      await p2pSyncManager.scanNetworkAndAutoSync();
      const dbs = p2pSyncManager.getAvailableNetworkDatabases().filter(
        (d) => d.name.toLowerCase() !== 'main store'
      );
      setAvailableDbs(dbs);
    } finally {
      setIsScanning(false);
    }
  };

  // Option 1: Connect to an existing database discovered on LAN
  const handleConnectSync = async (targetDbName: string) => {
    try {
      setSyncingDbName(targetDbName);
      setError(null);

      // Connect to chosen network database
      await p2pSyncManager.switchNetworkSyncGroup(targetDbName, false);

      // Give peer up to 3 seconds to deliver FULL_SYNC
      let attempts = 0;
      while (attempts < 6) {
        await new Promise((r) => setTimeout(r, 500));
        const hasUsers = await db.hasUsers();
        if (hasUsers) break;
        attempts++;
      }

      onSetupComplete();
    } catch (err: unknown) {
      console.error('Failed to sync database from network:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to connect to network database: ${msg}`);
    } finally {
      setSyncingDbName(null);
    }
  };

  // Option 2: Create a new account and database
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanProp = propertyName.trim();
    const cleanFull = fullName.trim();
    const cleanUser = username.trim().toLowerCase();

    if (!cleanProp) {
      setError('Please provide a Hotel or Property Name.');
      return;
    }
    if (!cleanFull) {
      setError('Please provide the Manager Full Name.');
      return;
    }
    if (!cleanUser) {
      setError('Please provide a valid Manager Username.');
      return;
    }
    if (!password || password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify both password fields.');
      return;
    }

    setLoading(true);

    try {
      const newEpoch = Date.now();
      const newDbId = `db_${newEpoch}_${Math.random().toString(36).substring(2, 7)}`;

      // 0. Ensure local database is clean of any pre-existing shifts/drawers
      await db.resetDatabaseToFactoryDefaults();
      localStorage.setItem('cdm_last_purged_epoch', String(newEpoch));
      localStorage.removeItem('cdm_local_active_shift_id');
      localStorage.removeItem('frontdesk_external_logs');
      if (typeof window !== 'undefined') {
        window.postMessage({ type: 'FDP_PURGE_EXTENSION_STORAGE' }, '*');
      }

      // 1. Save property name
      await db.saveOrganizationName(cleanProp);

      // 2. Save settings with fresh databaseEpoch and databaseId
      const nowIso = new Date().toISOString();
      const currentSettings = await db.getSettings();
      const updatedSettings: AppSettings = {
        ...currentSettings,
        organizationName: cleanProp,
        databaseEpoch: newEpoch,
        databaseId: newDbId,
        isRestoredArchive: false,
        createdBy: cleanFull,
        createdAt: nowIso,
      };
      await db.saveSettings(updatedSettings);

      // 3. Create primary Manager account
      const managerUser: UserAccount = {
        id: `usr_manager_${Date.now()}`,
        username: cleanUser,
        fullName: cleanFull,
        passwordHash: password,
        role: 'manager',
        createdAt: nowIso,
        isActive: true,
      };

      await db.saveUser(managerUser);

      // 4. Switch sync group to new hotel name and broadcast new database to all devices on network
      await p2pSyncManager.switchNetworkSyncGroup(cleanProp, true);
      p2pSyncManager.rememberSyncGroup(cleanProp, { createdBy: cleanFull, createdAt: nowIso });
      p2pSyncManager.broadcastNewDatabaseCreated(updatedSettings, managerUser, cleanProp);
      await p2pSyncManager.announceCurrentDatabase();

      // 5. Immediately log in the manager
      authManager.updateCurrentUser(managerUser);

      onSetupComplete(managerUser);
    } catch (err: unknown) {
      console.error('Setup error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Setup error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-gray-100 dark:border-gray-700 flex flex-col max-h-[92vh]">
        {/* Welcome Header */}
        <div className="bg-slate-900 px-6 py-5 text-white border-b border-slate-800">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 bg-blue-600/20 text-blue-400 rounded-xl flex items-center justify-center border border-blue-500/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                FrontDesk Register Setup
              </h2>
              <p className="text-xs text-slate-400">
                No local database was found on this station. Choose how you want to set up:
              </p>
            </div>
          </div>

          {/* 2 Setup Options Segmented Control */}
          <div className="grid grid-cols-2 gap-2 mt-4 p-1 bg-slate-800/80 rounded-xl border border-slate-700/80">
            <button
              type="button"
              onClick={() => {
                userSelectedTabRef.current = true;
                setActiveTab('sync');
                setError(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition ${
                activeTab === 'sync'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>1. Sync from Network</span>
              {availableDbs.length > 0 && (
                <span className="px-1.5 py-0.2 bg-emerald-500 text-white text-[10px] font-bold rounded-full">
                  {availableDbs.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                userSelectedTabRef.current = true;
                setActiveTab('create');
                setError(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition ${
                activeTab === 'create'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>2. Create Account</span>
            </button>
          </div>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start space-x-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ================= OPTION 1: SYNC FROM LOCAL NETWORK ================= */}
          {activeTab === 'sync' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Available Databases on Local Network
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Connect and synchronize with any hotel register active on your Wi-Fi/LAN
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleRescan}
                  disabled={isScanning}
                  className="px-2.5 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg flex items-center space-x-1.5 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                  <span>{isScanning ? 'Scanning...' : 'Scan Again'}</span>
                </button>
              </div>

              {/* List of Available Discovered Databases */}
              {availableDbs.length > 0 ? (
                <div className="space-y-2.5">
                  {availableDbs.map((dbItem) => {
                    const isConnectingThis = syncingDbName === dbItem.name;
                    return (
                      <div
                        key={dbItem.name}
                        className="p-4 bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600 rounded-xl hover:border-blue-300 dark:hover:border-blue-700 transition flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-3 truncate mr-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div className="truncate">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                {dbItem.name}
                              </span>
                              <span className="inline-flex items-center px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold rounded shrink-0">
                                <Radio className="w-2.5 h-2.5 mr-1 text-emerald-600 animate-pulse" />
                                Online on LAN
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                              <span className="inline-flex items-center text-gray-700 dark:text-gray-300 font-medium">
                                <User className="w-3 h-3 mr-1 text-blue-500 shrink-0" />
                                Created by <strong className="ml-1 text-gray-900 dark:text-white">{dbItem.createdBy || 'Manager'}</strong>
                              </span>
                              {(dbItem.createdAt || dbItem.epoch > 0) && (
                                <span className="inline-flex items-center text-gray-500 dark:text-gray-400">
                                  <Clock className="w-3 h-3 mr-1 text-gray-400 shrink-0" />
                                  {formatCreatedTime(dbItem.createdAt || dbItem.epoch)}
                                </span>
                              )}
                              <span className="text-gray-400 dark:text-gray-500 text-[10px]">
                                {dbItem.shiftsCount !== undefined && dbItem.shiftsCount > 0
                                  ? `· ${dbItem.shiftsCount} shift records`
                                  : '· Ready to sync'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleConnectSync(dbItem.name)}
                          disabled={!!syncingDbName}
                          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shrink-0 transition shadow-xs"
                        >
                          {isConnectingThis ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Connecting...</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5" />
                              <span>Connect & Sync</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Empty state when no databases are discovered */
                <div className="p-6 bg-gray-50 dark:bg-gray-700/30 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl text-center space-y-3">
                  <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto">
                    <WifiOff className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                      No Active Sync Databases Found on LAN
                    </h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto leading-relaxed">
                      Ensure another computer is running FrontDesk on the same Wi-Fi/LAN, or proceed to Option 2 to create an account and start a new database.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('create')}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Proceed to Option 2: Create Account</span>
                  </button>
                </div>
              )}

              {/* Informational Footer */}
              <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl text-[11px] text-blue-800 dark:text-blue-300 flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <span>
                  Syncing copies all shift till balances, guest complaints, sales leads, and staff accounts from the primary register instantly over your local network.
                </span>
              </div>
            </div>
          )}

          {/* ================= OPTION 2: CREATE ACCOUNT & DATABASE ================= */}
          {activeTab === 'create' && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
                <div className="font-bold flex items-center space-x-1.5 text-gray-900 dark:text-white mb-1">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Start a New Hotel Network Database</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  Use this option if no sync database is available on your network or if you are setting up a new property. This device will host the primary database.
                </p>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-3.5">
                {/* Property Name */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Hotel / Property Name *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Best Western Inn & Suites"
                      value={propertyName}
                      onChange={(e) => {
                        userSelectedTabRef.current = true;
                        setPropertyName(e.target.value);
                      }}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-semibold transition"
                    />
                  </div>
                </div>

                {/* Manager Full Name */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Manager Full Name *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sarah Jenkins (General Manager)"
                      value={fullName}
                      onChange={(e) => {
                        userSelectedTabRef.current = true;
                        setFullName(e.target.value);
                      }}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-semibold transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Username */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                      Manager Username *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="e.g. manager"
                        value={username}
                        onChange={(e) => {
                          userSelectedTabRef.current = true;
                          setUsername(e.target.value);
                        }}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-mono font-semibold transition"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                      Password *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                        <Key className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        required
                        placeholder="Min 4 chars"
                        value={password}
                        onChange={(e) => {
                          userSelectedTabRef.current = true;
                          setPassword(e.target.value);
                        }}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs transition"
                      />
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        required
                        placeholder="Re-type password"
                        value={confirmPassword}
                        onChange={(e) => {
                          userSelectedTabRef.current = true;
                          setConfirmPassword(e.target.value);
                        }}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs transition"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center space-x-2 cursor-pointer ${
                    loading ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  <span>{loading ? 'Initializing Database & Network...' : 'Create Account & Initialize Sync Database'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
