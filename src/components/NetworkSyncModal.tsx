import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  Copy, 
  Check, 
  X, 
  ShieldCheck, 
  AlertCircle,
  Laptop,
  ArrowRight
} from 'lucide-react';
import { p2pSyncManager, SyncState } from '../utils/p2pSyncManager';

interface NetworkSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncTriggered?: () => void;
}

export function NetworkSyncModal({ isOpen, onClose, onSyncTriggered }: NetworkSyncModalProps) {
  const [syncState, setSyncState] = useState<SyncState>(p2pSyncManager.getState());
  const [targetCode, setTargetCode] = useState('');
  const [customHostCode, setCustomHostCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'join' | 'host'>('host');
  const [isProcessing, setIsProcessing] = useState(false);

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

  const handleCopy = () => {
    if (!syncState.myCode) return;
    navigator.clipboard.writeText(syncState.myCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleHost = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      await p2pSyncManager.hostNetwork(customHostCode || undefined);
    } catch {
      // Error handled in state
    } finally {
      setIsProcessing(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCode.trim()) return;
    setIsProcessing(true);
    try {
      await p2pSyncManager.joinNetwork(targetCode);
      onClose();
    } catch {
      // Error handled in state
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisconnect = () => {
    p2pSyncManager.disconnect();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-lg w-full overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-xl ${
              syncState.status === 'connected' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
            }`}>
              <Wifi size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Local Register Network Sync
              </h3>
              <p className="text-xs text-gray-500">
                P2P browser-to-browser synchronization for nearby devices
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
        <div className="p-6">
          {syncState.errorMessage && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2.5 text-xs text-red-700">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{syncState.errorMessage}</span>
            </div>
          )}

          {syncState.status === 'connected' ? (
            /* Active Connected State */
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5 text-center">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 mb-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5 animate-pulse"></span>
                  Network Active
                </span>

                <div className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">
                  Your Store Network Code
                </div>
                <div className="flex items-center justify-center space-x-3 my-2">
                  <span className="font-mono text-3xl font-extrabold text-gray-900 tracking-wider">
                    {syncState.myCode}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition shadow-xs text-gray-600"
                    title="Copy Code"
                  >
                    {copied ? <Check size={18} className="text-green-600" /> : <Copy size={18} />}
                  </button>
                </div>

                <p className="text-xs text-gray-600 mt-2 max-w-sm mx-auto">
                  Enter this code on your second or third register to sync drawer data in real-time.
                </p>
              </div>

              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Laptop className="text-blue-600" size={22} />
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">Connected Registers</h4>
                    <p className="text-xs text-gray-500">
                      {syncState.connectedCount === 0 
                        ? 'Waiting for other computers to connect...' 
                        : `${syncState.connectedCount} peer register${syncState.connectedCount > 1 ? 's' : ''} currently in sync`}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold bg-white border px-2.5 py-1 rounded-md text-gray-700">
                  {syncState.connectedCount + 1} Total Tills
                </span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="inline-flex items-center text-xs font-semibold text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition"
                >
                  <WifiOff size={14} className="mr-1.5" />
                  Leave Network / Disconnect
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 bg-blue-600 text-white font-semibold text-xs rounded-lg hover:bg-blue-700 transition shadow-xs"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Disconnected / Setup State */
            <div className="space-y-6">
              {/* Tab Selector */}
              <div className="flex rounded-lg bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('host')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                    activeTab === 'host' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Create Store Network (Host)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('join')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                    activeTab === 'join' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Connect to Existing Register
                </button>
              </div>

              {activeTab === 'host' ? (
                <form onSubmit={handleHost} className="space-y-4">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Make this machine the primary register hub. Other computers on your Wi-Fi will connect using the generated Store Code.
                  </p>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Store Room Code (Optional Custom Name)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. STORE-1 (Leave blank to generate)"
                      value={customHostCode}
                      onChange={(e) => setCustomHostCode(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 uppercase"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full py-2.5 px-4 bg-blue-600 text-white font-semibold text-xs rounded-lg hover:bg-blue-700 transition shadow-xs disabled:opacity-50"
                  >
                    {isProcessing ? 'Generating Network...' : 'Start Store Network'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleJoin} className="space-y-4">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Enter the Store Network Code displayed on the main register to establish a real-time sync channel.
                  </p>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Target Store Code *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Enter 4-8 digit code (e.g. A4K9)"
                      value={targetCode}
                      onChange={(e) => setTargetCode(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 uppercase"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessing || !targetCode.trim()}
                    className="w-full py-2.5 px-4 bg-green-600 text-white font-semibold text-xs rounded-lg hover:bg-green-700 transition shadow-xs disabled:opacity-50 flex items-center justify-center"
                  >
                    {isProcessing ? 'Connecting...' : (
                      <>
                        Connect & Sync Data <ArrowRight size={15} className="ml-1.5" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Security notice */}
              <div className="pt-2 border-t border-gray-100 flex items-start space-x-2 text-[11px] text-gray-500">
                <ShieldCheck size={14} className="text-green-600 shrink-0 mt-0.5" />
                <span>
                  <strong>100% Peer-to-Peer:</strong> Data is synchronized directly over your local connection. All shift records are written to each device's local storage.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default NetworkSyncModal;
