import React, { useState } from 'react';
import { Lock, User, Key, AlertCircle, LogIn, CheckCircle2 } from 'lucide-react';
import { authManager } from '../utils/authManager';
import { UserAccount } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onSuccess: (user: UserAccount) => void;
  required?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
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
        onSuccess(result.user);
        if (onClose) onClose();
      } else {
        setError(result.error || 'Authentication failed. Please verify credentials.');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoUser: string, demoPass: string) => {
    setUsername(demoUser);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 dark:border-gray-700">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-5 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-sm">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Staff Login Required</h2>
              <p className="text-xs text-blue-100 mt-0.5">
                Sign in to manage drawers, cash drops, and shift logs
              </p>
            </div>
          </div>
        </div>

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

            {/* Quick Demo Credentials for Fast Testing */}
            <div className="pt-2 pb-1 border-t border-gray-100 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium block mb-2">
                Quick Sign-In Presets:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('manager', 'password123')}
                  className="flex items-center justify-center space-x-1 px-3 py-2 text-xs font-medium bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800 transition"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Manager</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('clerk1', 'clerk123')}
                  className="flex items-center justify-center space-x-1 px-3 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-600 transition"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Clerk 1</span>
                </button>
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
                className={`flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-xl shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition flex items-center justify-center space-x-2 ${
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
