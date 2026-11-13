import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  X, 
  AlertCircle,
  RefreshCw,
  Store,
  CheckCircle2
} from 'lucide-react';
import { p2pSyncManager, SyncState } from '../utils/p2pSyncManager';

interface NetworkSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncTriggered?: () => void;
}

export function NetworkSyncModal({ isOpen, onClose, onSyncTriggered }: NetworkSyncModalProps) {
  const [syncState, setSyncState] = useState<SyncState>(p2pSyncManager.getState());
  const [storeNameInput, setStoreNameInput] = useState(syncState.storeName || 'Main Store');
  const [isEditingStore, setIsEditingStore] = useState(false);

  useEffect(() => {
    const unsubscribe = p2pSyncManager.subscribeState((newState) => {
      setSyncState(newState);
      if (newState.status === 'connected' && onSyncTriggered) {
        onSyncTriggered();
      }
    });
    return () => unsubscribe();
  }, [onSyncTriggered]);

  if (!isOpen) return null;

  const handleApplyStoreName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeNameInput.trim()) return;
    setIsEditingStore(false);
    p2pSyncManager.autoConnect(storeNameInput.trim());
  };

  const handleRescan = () => {
    p2pSyncManager.autoConnect(storeNameInput.trim());
  };

  const handleDisconnect = () => {
    p2pSyncManager.disconnect();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-md w-full overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-xl ${
              syncState.status === 'connected' 
                ? 'bg-green-100 text-green-700' 
                : syncState.status === 'scanning'
                  ? 'bg-amber-100 text-amber-700 animate-pulse'
                  : 'bg-gray-100 text-gray-600'
            }`}>
              <Wifi size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Automatic Network Sync
              </h3>
              <p className="text-xs text-gray-500">
                Zero-setup peer synchronization for store registers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {syncState.errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2.5 text-xs text-red-700">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{syncState.errorMessage}</span>
            </div>
          )}

          {/* Current Live Status Card */}
          <div className={`p-5 rounded-2xl border ${
            syncState.status === 'connected'
              ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
              : syncState.status === 'scanning'
                ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200'
                : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                syncState.status === 'connected'
                  ? 'bg-green-100 text-green-800'
                  : syncState.status === 'scanning'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-gray-200 text-gray-700'
              }`}>
                <span className={`w-2 h-2 rounded-full mr-1.5 ${
                  syncState.status === 'connected'
                    ? 'bg-green-500 animate-pulse'
                    : syncState.status === 'scanning'
                      ? 'bg-amber-500 animate-ping'
                      : 'bg-gray-400'
                }`}></span>
                {syncState.status === 'connected' && (
                  syncState.role === 'hub' ? 'Primary Register Hub' : 'Connected to Register Hub'
                )}
                {syncState.status === 'scanning' && 'Scanning Network...'}
                {syncState.status === 'disconnected' && 'Sync Paused'}
              </span>

              <button
                onClick={handleRescan}
                title="Re-scan and auto-connect"
                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-white/80 rounded-lg transition"
              >
                <RefreshCw size={14} className={syncState.status === 'scanning' ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-extrabold text-gray-900">
                {syncState.status === 'connected' ? (
                  syncState.role === 'hub' ? (
                    syncState.connectedCount === 0
                      ? 'Active as Main Register Hub'
                      : `Syncing with ${syncState.connectedCount} Other Register${syncState.connectedCount > 1 ? 's' : ''}`
                  ) : (
                    'Synchronized with Main Register'
                  )
                ) : syncState.status === 'scanning' ? (
                  'Searching for existing store registers...'
                ) : (
                  'Offline / Local Mode'
                )}
              </h4>
              <p className="text-xs text-gray-600 leading-relaxed">
                {syncState.status === 'connected'
                  ? 'Any drawer opened, balance counted, or shift closed on any computer will sync instantly.'
                  : 'Opening the register app on any computer on this network will automatically link it.'}
              </p>
            </div>
          </div>

          {/* Store Network Group / Channel */}
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2 text-xs font-bold text-gray-700">
                <Store size={15} className="text-blue-600" />
                <span>Store Sync Group:</span>
              </div>
              {!isEditingStore && (
                <button
                  type="button"
                  onClick={() => setIsEditingStore(true)}
                  className="text-xs text-blue-600 hover:underline font-semibold"
                >
                  Change
                </button>
              )}
            </div>

            {isEditingStore ? (
              <form onSubmit={handleApplyStoreName} className="space-y-2 mt-2">
                <input
                  type="text"
                  value={storeNameInput}
                  onChange={(e) => setStoreNameInput(e.target.value)}
                  placeholder="e.g. Main Store, Downtown Branch"
                  className="w-full px-3 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex space-x-2">
                  <button
                    type="submit"
                    className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700"
                  >
                    Save & Reconnect
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingStore(false)}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-gray-900">
                  {syncState.storeName}
                </span>
                <span className="text-[11px] text-gray-500">
                  All devices using this name auto-pair
                </span>
              </div>
            )}
          </div>

          {/* Auto-connect Explanation */}
          <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-4 text-xs text-blue-900 space-y-2">
            <div className="font-bold flex items-center">
              <CheckCircle2 size={15} className="text-blue-600 mr-1.5" />
              How Auto-Discovery Works:
            </div>
            <ul className="space-y-1.5 text-blue-800/90 pl-4 list-disc">
              <li><strong>No codes to type:</strong> Launching the app on Computer 1 automatically claims the Hub.</li>
              <li><strong>Instant Connection:</strong> Launching on Computer 2 or 3 automatically finds Computer 1 and connects in seconds.</li>
              <li><strong>Automatic Failover:</strong> If the primary computer is closed or rebooted, another register automatically steps up as the Hub.</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center pt-1 border-t border-gray-100">
            {syncState.status === 'connected' ? (
              <button
                type="button"
                onClick={handleDisconnect}
                className="inline-flex items-center text-xs font-semibold text-red-600 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition"
              >
                <WifiOff size={14} className="mr-1.5" />
                Pause Sync
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRescan}
                className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-700 p-1.5 hover:bg-blue-50 rounded-lg transition"
              >
                <RefreshCw size={14} className="mr-1.5" />
                Auto-Connect Now
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-blue-600 text-white font-semibold text-xs rounded-lg hover:bg-blue-700 transition shadow-xs"
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
