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
  Radio,
  User,
  Clock,
  Monitor,
  Edit3,
  Link2,
  AlertTriangle,
  Server,
  Terminal,
  Copy,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { 
  p2pSyncManager, 
  SyncState, 
  AvailableNetworkDatabase,
  ConnectedStationInfo,
  SyncLogEntry
} from '../utils/p2pSyncManager';

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

interface NetworkSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncTriggered?: () => void;
  onRequestCreateNewHotel?: () => void;
}

export function NetworkSyncModal({ isOpen, onClose, onSyncTriggered, onRequestCreateNewHotel }: NetworkSyncModalProps) {
  const [syncState, setSyncState] = useState<SyncState>(p2pSyncManager.getState());
  const [availableDbs, setAvailableDbs] = useState<AvailableNetworkDatabase[]>(
    p2pSyncManager.getAvailableNetworkDatabases()
  );
  const [stations, setStations] = useState<ConnectedStationInfo[]>(
    p2pSyncManager.getConnectedStations()
  );
  const [newGroupName, setNewGroupName] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [stationNameInput, setStationNameInput] = useState('');
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>(p2pSyncManager.getSyncLogs());
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);

  useEffect(() => {
    const unsubState = p2pSyncManager.subscribeState((newState) => {
      setSyncState(newState);
      setAvailableDbs(p2pSyncManager.getAvailableNetworkDatabases());
      setStations(p2pSyncManager.getConnectedStations());
      setSyncLogs(p2pSyncManager.getSyncLogs());
      if (newState.status === 'connected' && onSyncTriggered) {
        onSyncTriggered();
      }
      if (newState.status === 'error') {
        setShowDiagnostics(true);
      }
    });

    const unsubData = p2pSyncManager.subscribeData((action) => {
      if (action === 'AVAILABLE_DATABASES_UPDATED' || action === 'NETWORK_SWITCH_FOLLOWED') {
        setAvailableDbs(p2pSyncManager.getAvailableNetworkDatabases());
      }
      if (action === 'STATION_PRESENCE_UPDATED' || action === 'SYNC_COMPLETED') {
        setStations(p2pSyncManager.getConnectedStations());
      }
      if (action === 'SYNC_LOGS_UPDATED') {
        setSyncLogs(p2pSyncManager.getSyncLogs());
      }
    });

    return () => {
      unsubState();
      unsubData();
    };
  }, [onSyncTriggered]);

  if (!isOpen) return null;

  const handleCopyLogs = () => {
    const text = syncLogs
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}${l.details ? ` (${l.details})` : ''}`)
      .join('\n');
    try {
      navigator.clipboard.writeText(text);
      setCopiedLogs(true);
      setTimeout(() => setCopiedLogs(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleSaveStationName = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!stationNameInput.trim()) return;
    p2pSyncManager.setStationName(stationNameInput.trim());
    setStations(p2pSyncManager.getConnectedStations());
    setIsEditingName(false);
  };

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

            <div className="space-y-1">
              <div className="flex items-center space-x-1.5 flex-wrap">
                <span className="text-[11px] text-gray-500 dark:text-gray-400">Current Database:</span>
                <span className="text-xs font-bold text-gray-900 dark:text-white bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-md">
                  {syncState.storeName}
                </span>
              </div>
              <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-200 pt-0.5">
                {syncState.status === 'connected' ? (
                  syncState.role === 'hub' ? (
                    syncState.connectedCount === 0
                      ? 'Active as Primary Hotel Hub for this database'
                      : `Syncing with ${syncState.connectedCount} other register${syncState.connectedCount > 1 ? 's' : ''}`
                  ) : (
                    'Synchronized with Primary Register'
                  )
                ) : syncState.status === 'scanning' ? (
                  'Searching for existing hotel registers on network...'
                ) : (
                  'Offline Mode / Sync Paused'
                )}
              </h4>
              <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">
                {syncState.status === 'connected'
                  ? 'All shifts, till balances, notes, and staff accounts sync instantly across computers in this hotel group.'
                  : 'Click on any discovered hotel database below to connect and sync with it.'}
              </p>
            </div>
          </div>

          {/* Connected Stations & Live User Presence */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50/50 dark:bg-gray-800/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-gray-700 dark:text-gray-300">
                <Monitor size={16} className="text-emerald-600 dark:text-emerald-400" />
                <span>Connected Registers & Active Staff</span>
              </div>
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                {stations.length} System{stations.length === 1 ? '' : 's'} Online
              </span>
            </div>

            <div className="space-y-2">
              {Array.from(
                new Map(stations.map((st) => [st.deviceId || st.peerId, st])).values()
              ).map((st) => (
                <div
                  key={st.deviceId || st.peerId}
                  className={`p-3 rounded-xl border transition-all ${
                    st.isThisDevice
                      ? 'bg-white dark:bg-gray-700/80 border-blue-200 dark:border-blue-800 shadow-xs ring-1 ring-blue-500/20'
                      : 'bg-white dark:bg-gray-700/50 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    {/* Left: Device Name & User */}
                    <div className="flex items-start space-x-2.5 min-w-0">
                      <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        st.isThisDevice
                          ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                          : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                      }`}>
                        <Monitor size={15} />
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center space-x-1.5 flex-wrap">
                          {st.isThisDevice && isEditingName ? (
                            <form onSubmit={handleSaveStationName} className="flex items-center space-x-1">
                              <input
                                type="text"
                                value={stationNameInput}
                                onChange={(e) => setStationNameInput(e.target.value)}
                                className="text-xs font-bold px-1.5 py-0.5 border border-blue-400 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                autoFocus
                              />
                              <button
                                type="submit"
                                className="p-1 text-emerald-600 hover:text-emerald-700 rounded"
                                title="Save name"
                              >
                                <Check size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsEditingName(false)}
                                className="p-1 text-gray-400 hover:text-gray-600 rounded"
                              >
                                <X size={12} />
                              </button>
                            </form>
                          ) : (
                            <>
                              <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                {st.stationName}
                              </span>
                              {st.isThisDevice && (
                                <span className="text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold px-1.5 py-0.2 rounded">
                                  This PC
                                </span>
                              )}
                              {st.isPrimaryHub && (
                                <span className="text-[10px] bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold px-1.5 py-0.2 rounded flex items-center">
                                  <Server size={9} className="mr-0.5" />
                                  Primary Hub
                                </span>
                              )}
                              {st.isThisDevice && !isEditingName && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setStationNameInput(st.stationName);
                                    setIsEditingName(true);
                                  }}
                                  className="text-gray-400 hover:text-blue-600 p-0.5 rounded transition"
                                  title="Rename this register PC"
                                >
                                  <Edit3 size={11} />
                                </button>
                              )}
                            </>
                          )}
                        </div>

                        {/* Logged in User */}
                        <div className="flex items-center space-x-1 text-xs">
                          {st.loggedInUser ? (
                            <span className="inline-flex items-center text-emerald-700 dark:text-emerald-300 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded text-[11px]">
                              <User size={11} className="mr-1 text-emerald-600 dark:text-emerald-400" />
                              <strong>{st.loggedInUser.fullName || st.loggedInUser.username}</strong>
                              <span className="ml-1 text-gray-500 dark:text-gray-400 text-[10px]">(@{st.loggedInUser.username})</span>
                              <span className="ml-1 text-[9px] uppercase font-bold px-1 py-0.2 rounded bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200">
                                {st.loggedInUser.role}
                              </span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-gray-400 dark:text-gray-500 italic flex items-center">
                              <User size={11} className="mr-1 opacity-50" />
                              No staff signed in (Standby)
                            </span>
                          )}
                        </div>

                        {/* Notice if station is connected to a different database */}
                        {st.databaseName && st.databaseName !== syncState.storeName && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center space-x-1 pt-0.5">
                            <AlertTriangle size={11} className="shrink-0" />
                            <span>On database: "{st.databaseName}"</span>
                            <button
                              type="button"
                              onClick={() => handleSelectGroup(st.databaseName)}
                              className="underline hover:text-amber-700 dark:hover:text-amber-300 ml-1 font-bold"
                            >
                              Sync Together
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Sync Status Badge (Connection Established vs In Sync) */}
                    <div className="shrink-0 text-right">
                      {st.syncStage === 'in_sync' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>
                          In Sync
                        </span>
                      ) : st.syncStage === 'connection_established' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                          <Link2 size={10} className="mr-1 text-blue-600" />
                          Connection Established
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                          <RefreshCw size={10} className="mr-1 animate-spin text-amber-600" />
                          Connecting...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                          <span className="font-medium text-gray-700 dark:text-gray-300 flex items-center">
                            <User size={10} className="mr-0.5 text-blue-500" />
                            Created by {dbItem.createdBy || 'Manager'}
                          </span>
                          {(dbItem.createdAt || dbItem.epoch > 0) && (
                            <span className="flex items-center text-gray-400">
                              <Clock size={10} className="mr-0.5" />
                              {formatCreatedTime(dbItem.createdAt || dbItem.epoch)}
                            </span>
                          )}
                          <span className="text-gray-400">
                            {isActive 
                              ? '· Connected' 
                              : dbItem.isHostedOnPeer 
                                ? '· Ready to switch' 
                                : '· Auto-sync ready'}
                          </span>
                        </div>
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
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onRequestCreateNewHotel) {
                      onRequestCreateNewHotel();
                    } else {
                      setIsAddingNew(true);
                    }
                  }}
                  className="w-full py-2.5 px-3 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300 transition flex items-center justify-center space-x-1.5"
                >
                  <Plus size={14} className="text-blue-600 dark:text-blue-400" />
                  <span>Create New Account / Database (Option 2)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddingNew(true)}
                  className="w-full py-2 border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center justify-center space-x-1.5"
                >
                  <ArrowRightLeft size={13} />
                  <span>Add / Connect Another Database by Name</span>
                </button>
              </div>
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

          {/* Real-time Connection Diagnostics & Live Error Log Box */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-gray-50/50 dark:bg-gray-800/50">
            <button
              type="button"
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-100/60 dark:hover:bg-gray-700/60 transition"
            >
              <div className="flex items-center space-x-2">
                <Terminal size={15} className="text-slate-600 dark:text-slate-300" />
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                  Connection Diagnostics & Error Log Box
                </span>
                {syncLogs.some((l) => l.level === 'error') && (
                  <span className="px-1.5 py-0.2 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 rounded text-[10px] font-bold">
                    Errors Logged
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                <span className="text-[11px]">{showDiagnostics ? 'Hide Code Box' : 'Show Code Box'}</span>
                {showDiagnostics ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </button>

            {showDiagnostics && (
              <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-950 text-gray-100 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-gray-400 pb-1.5 border-b border-gray-800">
                  <span className="font-mono text-[10px]">P2P Diagnostic Console ({syncLogs.length} events)</span>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleCopyLogs}
                      className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded text-[10px] flex items-center space-x-1 transition"
                    >
                      <Copy size={10} />
                      <span>{copiedLogs ? 'Copied!' : 'Copy Logs'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => p2pSyncManager.clearSyncLogs()}
                      className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded text-[10px] transition"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="font-mono text-[10px] max-h-48 overflow-y-auto space-y-1 pr-1 bg-black/60 p-2 rounded-lg border border-gray-800/80">
                  {syncLogs.length === 0 ? (
                    <div className="text-gray-500 italic py-2 text-center text-[10px]">
                      No connection errors. Network sync is operating normally.
                    </div>
                  ) : (
                    syncLogs.map((log) => (
                      <div key={log.id} className="leading-relaxed flex items-start space-x-1.5">
                        <span className="text-gray-500 shrink-0 select-none">[{log.timestamp}]</span>
                        <span className={`px-1 py-0.1 rounded text-[9px] font-bold shrink-0 uppercase ${
                          log.level === 'error'
                            ? 'bg-red-900/80 text-red-200 border border-red-700'
                            : log.level === 'warn'
                              ? 'bg-amber-900/80 text-amber-200 border border-amber-700'
                              : log.level === 'success'
                                ? 'bg-emerald-900/80 text-emerald-200 border border-emerald-700'
                                : 'bg-blue-900/80 text-blue-200 border border-blue-700'
                        }`}>
                          {log.level}
                        </span>
                        <span className={`break-all ${
                          log.level === 'error'
                            ? 'text-red-300 font-semibold'
                            : log.level === 'warn'
                              ? 'text-amber-300'
                              : log.level === 'success'
                                ? 'text-emerald-300'
                                : 'text-gray-300'
                        }`}>
                          {log.message}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="text-[10px] text-gray-400 bg-gray-900/70 p-2 rounded border border-gray-800 flex items-start space-x-1.5">
                  <Info size={12} className="shrink-0 mt-0.5 text-blue-400" />
                  <span>
                    <strong>Network Troubleshooting:</strong> If a register is having trouble connecting, check if Windows Network Profile is set to <strong>"Private network"</strong>. Automatic TURN relay fallback (ports 80/443) is enabled to bypass hotel Wi-Fi Client Isolation.
                  </span>
                </div>
              </div>
            )}
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