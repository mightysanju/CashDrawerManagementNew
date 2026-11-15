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
  ArrowRightLeft
} from 'lucide-react';
import { p2pSyncManager, SyncState } from '../utils/p2pSyncManager';

interface NetworkSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncTriggered?: () => void;
}

export function NetworkSyncModal({ isOpen, onClose, onSyncTriggered }: NetworkSyncModalProps) {
  const [syncState, setSyncState] = useState<SyncState>(p2pSyncManager.getState());
  const [knownGroups, setKnownGroups] = useState<string[]>(p2pSyncManager.getKnownSyncGroups());
  const [newGroupName, setNewGroupName] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    const unsubscribe = p2pSyncManager.subscribeState((newState) => {
      setSyncState(newState);
      setKnownGroups(p2pSyncManager.getKnownSyncGroups());
      if (newState.status === 'connected' && onSyncTriggered) {
        onSyncTriggered();
      }
    });
    return () => unsubscribe();
  }, [onSyncTriggered]);

  if (!isOpen) return null;

  const handleSelectGroup = async (group: string) => {
    if (group === syncState.storeName) return;
    setIsSwitching(true);
    await p2pSyncManager.switchSyncGroup(group);
    setIsSwitching(false);
  };

  const handleAddNewGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newGroupName.trim();
    if (!clean) return;
    setIsAddingNew(false);
    setNewGroupName('');
    setIsSwitching(true);
    await p2pSyncManager.switchSyncGroup(clean);
    setIsSwitching(false);
  };

  const handleRemoveGroup = (e: React.MouseEvent, group: string) => {
    e.stopPropagation();
    p2pSyncManager.removeKnownSyncGroup(group);
    setKnownGroups(p2pSyncManager.getKnownSyncGroups());
  };

  const handleRescan = () => {
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
                Auto-syncs & remembers selection
              </span>
            </div>

            {/* List of Known Hotel Databases */}
            <div className="space-y-2">
              {knownGroups.map((group) => {
                const isActive = group === syncState.storeName;
                return (
                  <div
                    key={group}
                    onClick={() => handleSelectGroup(group)}
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
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs font-bold truncate ${
                            isActive ? 'text-blue-900 dark:text-blue-100' : 'text-gray-800 dark:text-gray-200'
                          }`}>
                            {group}
                          </span>
                          {isActive && (
                            <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold rounded">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                          {isActive ? 'Currently connected & syncing' : 'Click to switch & auto-sync'}
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
                              handleSelectGroup(group);
                            }}
                            className="px-2 py-1 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 hover:bg-blue-50 text-[11px] font-semibold text-gray-700 dark:text-gray-200 rounded-md flex items-center space-x-1"
                          >
                            <ArrowRightLeft size={11} />
                            <span>Switch</span>
                          </button>
                          {knownGroups.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => handleRemoveGroup(e, group)}
                              title="Forget this hotel group"
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
                    Connect
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
                className="w-full py-2 px-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 flex items-center justify-center space-x-1.5 transition"
              >
                <Plus size={14} />
                <span>Add / Connect Another Hotel Database</span>
              </button>
            )}
          </div>

          {/* Auto-Discovery Explanation Card */}
          <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-800/40 rounded-xl p-3.5 text-xs text-blue-900 dark:text-blue-200 space-y-1.5">
            <div className="font-bold flex items-center">
              <CheckCircle2 size={15} className="text-blue-600 dark:text-blue-400 mr-1.5" />
              <span>How Hotel Auto-Discovery Works:</span>
            </div>
            <ul className="space-y-1 text-blue-800/90 dark:text-blue-300/80 pl-4 list-disc text-[11px] leading-relaxed">
              <li><strong>Zero Configuration:</strong> All devices sharing this Hotel Name automatically discover each other over your local Wi-Fi or LAN.</li>
              <li><strong>Channel Isolation:</strong> Registers with different hotel names are securely isolated and will never mix records.</li>
              <li><strong>Offline Resilient:</strong> Works even when external internet is down using local peer routing.</li>
            </ul>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-700">
            {syncState.status === 'connected' ? (
              <button
                type="button"
                onClick={handleDisconnect}
                className="inline-flex items-center text-xs font-semibold text-red-600 dark:text-red-400 hover:text-red-700 p-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
              >
                <WifiOff size={14} className="mr-1.5" />
                Pause Sync
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRescan}
                className="inline-flex items-center text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 p-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition"
              >
                <RefreshCw size={14} className="mr-1.5" />
                Auto-Connect Now
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-blue-600 text-white font-semibold text-xs rounded-xl hover:bg-blue-700 transition shadow-xs"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
export default NetworkSyncModal;