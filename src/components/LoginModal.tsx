import React, { useState } from 'react';
import { Lock, User, Key, AlertCircle, LogIn, X } from 'lucide-react';
import { authManager } from '../utils/authManager';
import { UserAccount } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onSuccess?: (user: UserAccount) => void;
  onLoginSuccess?: (user: UserAccount) => void;
  requiredAction?: string | null;
  required?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onLoginSuccess,
  requiredAction,
  required = false,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await authManager.login(username, password);
      if (result.success && result.user) {
        if (onSuccess) onSuccess(result.user);
        if (onLoginSuccess) onLoginSuccess(result.user);
        if (onClose) onClose();
      } else {
        setError(result.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err) {
      console.error('Login submit error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 dark:border-gray-700">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-slate-800 text-slate-200 rounded-xl border border-slate-700">
              <Lock className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Staff Sign In</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Sign in to manage drawers, cash drops, and shift logs
              </p>
            </div>
          </div>
          {!required && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Required Action Banner */}
        {requiredAction && (
          <div className="bg-blue-50 dark:bg-blue-900/30 border-b border-blue-100 dark:border-blue-800 px-6 py-2.5 text-xs text-blue-700 dark:text-blue-300 font-medium flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Action requires authentication: <strong>{requiredAction}</strong></span>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl flex items-start space-x-2 text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. manager or clerk1"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-3">
              {!required && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/3 py-2.5 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className={`flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-xl shadow-xs transition flex items-center justify-center space-x-2 cursor-pointer ${
                  loading ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                <LogIn className="w-4 h-4" />
                <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
