import React, { useState } from 'react';
import { Building2, ShieldCheck, User, Key, CheckCircle2, AlertCircle, Sparkles, ArrowRight } from 'lucide-react';
import { DatabaseManager } from '../utils/database';
import { authManager } from '../utils/authManager';
import { UserAccount } from '../types';

interface NewHotelSetupModalProps {
  isOpen: boolean;
  onSetupComplete: (manager: UserAccount) => void;
}

const db = new DatabaseManager();

export const NewHotelSetupModal: React.FC<NewHotelSetupModalProps> = ({
  isOpen,
  onSetupComplete,
}) => {
  const [propertyName, setPropertyName] = useState('Grand Hotel & Suites');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('manager');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
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
      // 1. Save property name
      await db.saveOrganizationName(cleanProp);

      // 2. Create primary Manager account
      const managerUser: UserAccount = {
        id: `usr_manager_${Date.now()}`,
        username: cleanUser,
        fullName: cleanFull,
        passwordHash: password,
        role: 'manager',
        createdAt: new Date().toISOString(),
        isActive: true,
      };

      await db.saveUser(managerUser);

      // 3. Immediately log in the manager
      authManager.updateCurrentUser(managerUser);

      onSetupComplete(managerUser);
    } catch (err) {
      console.error('Setup error:', err);
      setError('Failed to initialize database. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 dark:border-gray-700">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 px-6 py-6 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
          
          <div className="inline-flex items-center space-x-1.5 bg-white/15 px-3 py-1 rounded-full text-[11px] font-semibold text-blue-100 mb-3 backdrop-blur-xs border border-white/20">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>New Hotel Network Setup</span>
          </div>

          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-sm shadow-inner border border-white/30">
            <Building2 className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-xl font-extrabold text-white tracking-tight">
            Welcome to FrontDesk Pro!
          </h2>
          <p className="text-xs text-blue-100 mt-1 max-w-sm mx-auto leading-relaxed">
            No register database was found. Set up your property name and primary Manager account to initialize your secure register.
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start space-x-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
                  placeholder="e.g. Grand Ocean Resort & Suites"
                  value={propertyName}
                  onChange={(e) => setPropertyName(e.target.value)}
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
                  autoFocus
                  placeholder="e.g. Sarah Jenkins (General Manager)"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
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
                    onChange={(e) => setUsername(e.target.value)}
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
                    onChange={(e) => setPassword(e.target.value)}
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
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs transition"
                  />
                </div>
              </div>
            </div>

            {/* Network Features Guarantee */}
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl p-3 text-[11px] text-blue-900 dark:text-blue-200 space-y-1">
              <div className="flex items-center space-x-1.5 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <span>100% Private Local Storage (IndexedDB)</span>
              </div>
              <p className="text-blue-700 dark:text-blue-300 text-[10px] pl-5">
                Financial records stay within your local devices. You can add Front Desk Clerk accounts at any time from the Manager Console.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 hover:shadow-lg transition flex items-center justify-center space-x-2 ${
                loading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              <span>{loading ? 'Initializing Hotel Network...' : 'Create Manager Account & Initialize Network'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
