import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  X, 
  AlertCircle,
  RefreshCw,
  Building2,
  CheckCircle2,
  Check,
  Plus,
  Trash2,
  ArrowRightLeft,
  Radio
} from 'lucide-react';
import { p2pSyncManager, SyncState, AvailableNetworkDatabase } from '../utils/p2pSyncManager';

interface NetworkSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncTriggered?: () => void;
}

export function NetworkSyncModal({ isOpen, onClose, onSyncTriggered }: NetworkSyncModalProps) {
  const [syncState, setSyncState] = useState<SyncState>(p2pSyncManager.getState());
  const [availableDbs, setAvailableDbs] = useState<AvailableNetworkDatabase[]>(
    p2pSyncManager.getAvailableNetworkDatabases()
  );
  const [newGroupName, setNewGroupName] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    const unsubState = p2pSyncManager.subscribeState((newState) => {
      setSyncState(newState);
      setAvailableDbs(p2pSyncManager.getAvailableNetworkDatabases());
      if (newState.status === 'connected' && onSyncTriggered) {
        onSyncTriggered();
      }
    });

    const unsubData = p2pSyncManager.subscribeData((action) => {
      if (action === 'AVAILABLE_DATABASES_UPDATED' || action === 'NETWORK_SWITCH_FOLLOWED') {
        setAvailableDbs(p2pSyncManager.getAvailableNetworkDatabases());
      }
    });

    return () => {
      unsubState();
      unsubData();
    };
  }, [onSyncTriggered]);

  if (!isOpen) return null;

  const handleSelectGroup = async (group: string) => {
    if (group === syncState.storeName) return;
    setIsSwitching(true);
    await p2pSyncManager.switchNetworkSyncGroup(group, true);
    setIsSwitching(false);
  };

  const handleAddNewGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newGroupName.trim();
    if (!clean) return;
    setIsAddingNew(false);
    setNewGroupName('');
    setIsSwitching(true);
    await p2pSyncManager.switchNetworkSyncGroup(clean, true);
    setIsSwitching(false);
  };

  const handleRemoveGroup = (e: React.MouseEvent, group: string) => {
    e.stopPropagation();
    const confirmDelete = window.confirm(
      `Delete and remove "${group}" from this and all other synced computers on the network?`
    );
    if (!confirmDelete) return;
    p2pSyncManager.broadcastNetworkDatabaseDeleted(group);
    setAvailableDbs(p2pSyncManager.getAvailableNetworkDatabases());
  };

  const handleRescan = () => {
    p2pSyncManager.announceCurrentDatabase();
    p2pSyncManager.autoConnect(syncState.storeName);
  };

  const handleDisconnect = () => {
    p2pSyncManager.disconnect();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/80">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${
              syncState.status === 'connected' 
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400' 
                : syncState.status === 'scanning'
                  ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400' 
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              <Wifi size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Hotel Network Sync
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Local peer synchronization for hotel registers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {syncState.errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg flex items-start space-x-2 text-xs text-red-700 dark:text-red-300">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{syncState.errorMessage}</span>
            </div>
          )}

          {/* Current Live Status Card */}
          <div className={`p-4 rounded-xl border ${
            syncState.status === 'connected'
              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
              : syncState.status === 'scanning'
                ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                syncState.status === 'connected'
                  ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                  : syncState.status === 'scanning'
                    ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                  syncState.status === 'connected'
                    ? 'bg-emerald-500'
                    : syncState.status === 'scanning'
                      ? 'bg-amber-500'
                      : 'bg-slate-400'
                }`}></span>
                {syncState.status === 'connected' && (
                  syncState.role === 'hub' ? 'Primary Hotel Hub' : 'Connected to Hotel Hub'
                )}
                {syncState.status === 'scanning' && 'Scanning Network'}
                {syncState.status === 'disconnected' && 'Sync Paused'}
              </span>

              <button
                onClick={handleRescan}
                title="Re-scan and auto-connect"
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded transition-colors"
              >
                <RefreshCw size={13} className={syncState.status === 'scanning' || isSwitching ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="space-y-0.5">
              <h4 className="text-xs font-semibold text-gray-900 dark:text-white">
                {syncState.status === 'connected' ? (
                  syncState.role === 'hub' ? (
                    syncState.connectedCount === 0
                      ? 'Active as Primary Hotel Hub'
                      : `Syncing with ${syncState.connectedCount} other register${syncState.connectedCount > 1 ? 's' : ''}`
                  ) : (
                    'Synchronized with Primary Register'
                  )
                ) : syncState.status === 'scanning' ? (
                  'Searching for existing hotel registers'
                ) : (
                  'Offline Mode'
                )}
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                {syncState.status === 'connected'
                  ? 'All shifts, till balances, notes, and complaints sync instantly across computers in this hotel group.'
                  : 'Launching the app on any device on this local network automatically connects.'}
              </p>
            </div>
          </div>

          {/* Hotel Sync Group Selector */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50/50 dark:bg-gray-800/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-gray-700 dark:text-gray-300">
                <Building2 size={16} className="text-blue-600 dark:text-blue-400" />
                <span>Hotel Database Sync Group</span>
              </div>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                Network Auto-Discovery Active
              </span>
            </div>

            {/* List of Available Hotel Databases on Network */}
            <div className="space-y-2">
              {availableDbs.map((dbItem) => {
                const isActive = dbItem.isActive || dbItem.name === syncState.storeName;
                return (
                  <div
                    key={dbItem.name}
                    onClick={() => handleSelectGroup(dbItem.name)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      isActive
                        ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 shadow-xs'
                        : 'bg-white dark:bg-gray-700/50 border-gray-200 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-gray-50/80 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300'
                      }`}>
                        <Building2 size={16} />
                      </div>
                      <div className="truncate">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span className={`text-xs font-bold truncate ${
                            isActive ? 'text-blue-900 dark:text-blue-100' : 'text-gray-800 dark:text-gray-200'
                          }`}>
                            {dbItem.name}
                          </span>
                          {isActive && (
                            <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold rounded">
                              Active
                            </span>
                          )}
                          {dbItem.isHostedOnPeer && !isActive && (
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-medium rounded space-x-1">
                              <Radio size={10} className="mr-0.5 text-emerald-600 animate-pulse" />
                              <span>Online on LAN</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                          {isActive 
                            ? 'Currently connected & syncing with all registers' 
                            : dbItem.isHostedOnPeer 
                              ? 'Hosted on network register · Click to switch entire network' 
                              : 'Click to switch & auto-sync all devices'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {isActive ? (
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center">
                          <Check size={14} />
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectGroup(dbItem.name);
                            }}
                            className="px-2 py-1 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 hover:bg-blue-50 text-[11px] font-semibold text-gray-700 dark:text-gray-200 rounded-md flex items-center space-x-1"
                          >
                            <ArrowRightLeft size={11} />
                            <span>Switch All</span>
                          </button>
                          {availableDbs.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => handleRemoveGroup(e, dbItem.name)}
                              title="Delete/Forget this database from network"
                              className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add / Connect to Another Hotel Sync Group */}
            {isAddingNew ? (
              <form onSubmit={handleAddNewGroup} className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                  New Hotel / Branch Sync Group Name:
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g. Oceanfront Suites, Downtown Tower"
                    autoFocus
                    className="flex-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={!newGroupName.trim()}
                    className="px-3 py-1.5 bg-blue-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition"
                  >
                    Connect All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNew(false);
                      setNewGroupName('');
                    }}
                    className="px-2.5 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingNew(true)}
                className="w-full py-2 border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center justify-center space-x-1.5"
              >
                <Plus size={14} />
                <span>Add / Connect Another Hotel Database</span>
              </button>
            )}
          </div>

          {/* Educational Auto-Discovery Note */}
          <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 rounded-xl space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
            <div className="flex items-center space-x-1.5 font-bold text-blue-900 dark:text-blue-200">
              <CheckCircle2 size={14} className="text-blue-600 dark:text-blue-400" />
              <span>How Hotel Network Auto-Discovery Works:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-gray-600 dark:text-gray-400">
              <li>
                <strong className="text-gray-800 dark:text-gray-200">Automatic Sync:</strong> All computers on the network automatically discover available databases and stay synchronized.
              </li>
              <li>
                <strong className="text-gray-800 dark:text-gray-200">Network-Wide Switching:</strong> Switching or creating a database moves every register on the network together.
              </li>
              <li>
                <strong className="text-gray-800 dark:text-gray-200">Shared Purge:</strong> When a database is deleted, it is deleted from all synced devices.
              </li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/80 flex items-center justify-between">
          <button
            onClick={handleDisconnect}
            className="text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center space-x-1"
          >
            <WifiOff size={13} />
            <span>Pause Sync</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default NetworkSyncModal;