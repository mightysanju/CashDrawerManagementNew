import React, { useState, useEffect } from 'react';
import { 
  X, 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Tag, 
  DollarSign, 
  Trash2, 
  Check, 
  AlertCircle, 
  Settings, 
  PlusCircle 
} from 'lucide-react';
import { UserAccount, UserRole, LogCategoryConfig, AppSettings } from '../types';
import { DatabaseManager } from '../utils/database';
import { p2pSyncManager } from '../utils/p2pSyncManager';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
}

const db = new DatabaseManager();

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'categories' | 'settings'>('users');
  
  // Users state
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('clerk');
  const [userError, setUserError] = useState<string | null>(null);
  const [userSuccess, setUserSuccess] = useState<string | null>(null);

  // Categories state
  const [categories, setCategories] = useState<LogCategoryConfig[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [newCatSubcats, setNewCatSubcats] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [newSubcatInput, setNewSubcatInput] = useState('');

  // Settings state
  const [settings, setSettings] = useState<AppSettings>({
    id: 'default',
    salesRateMultiplier: 120,
    organizationName: 'Grand Hotel & Suites',
  });
  const [rateMultiplierInput, setRateMultiplierInput] = useState<number>(120);
  const [orgNameInput, setOrgNameInput] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      try {
        const [loadedUsers, loadedCats, loadedSettings] = await Promise.all([
          db.getUsers(),
          db.getCategories(),
          db.getSettings(),
        ]);
        setUsers(loadedUsers);
        setCategories(loadedCats);
        setSettings(loadedSettings);
        setRateMultiplierInput(loadedSettings.salesRateMultiplier || 120);
        setOrgNameInput(loadedSettings.organizationName || 'Grand Hotel & Suites');
      } catch (err) {
        console.error('Error loading manager data:', err);
      }
    };
    loadData();
    setUserError(null);
    setUserSuccess(null);
  }, [isOpen]);

  if (!isOpen) return null;

  // Add new staff user
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);
    setUserSuccess(null);

    const cleanUser = newUsername.trim().toLowerCase();
    if (!cleanUser || !newFullName.trim() || !newPassword) {
      setUserError('Please fill out all required user fields.');
      return;
    }

    // Check if username already exists
    const existing = users.find((u) => u.username.toLowerCase() === cleanUser);
    if (existing) {
      setUserError(`Username "${cleanUser}" already exists.`);
      return;
    }

    const newUser: UserAccount = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      username: cleanUser,
      passwordHash: newPassword, // Store password
      fullName: newFullName.trim(),
      role: newRole,
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    try {
      await db.saveUser(newUser);
      p2pSyncManager.broadcastUser(newUser);
      setUsers((prev) => [...prev, newUser]);
      setNewUsername('');
      setNewFullName('');
      setNewPassword('');
      setUserSuccess(`User "${newUser.fullName}" created successfully!`);
    } catch (err) {
      console.error('Failed to create user:', err);
      setUserError('Failed to save user in local database.');
    }
  };

  // Toggle user active status
  const handleToggleUserActive = async (user: UserAccount) => {
    if (user.id === currentUser.id) {
      alert('You cannot deactivate your own active session account.');
      return;
    }

    const updated: UserAccount = {
      ...user,
      isActive: !user.isActive,
    };

    await db.saveUser(updated);
    p2pSyncManager.broadcastUser(updated);
    setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
  };

  // Delete user
  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUser.id) {
      alert('You cannot delete your own active account.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this staff user account?')) {
      await db.deleteUser(userId);
      p2pSyncManager.broadcastUserDelete(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    }
  };

  // Add custom category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    const subs = newCatSubcats
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const newCat: LogCategoryConfig = {
      id: `cat_${Date.now()}`,
      name: newCatName.trim(),
      subcategories: subs.length > 0 ? subs : ['General'],
    };

    await db.saveCategory(newCat);
    p2pSyncManager.broadcastCategory(newCat);
    setCategories((prev) => [...prev, newCat]);
    setNewCatName('');
    setNewCatSubcats('');
  };

  // Add subcategory to existing category
  const handleAddSubcatToCat = async (cat: LogCategoryConfig) => {
    if (!newSubcatInput.trim()) return;
    const cleanSub = newSubcatInput.trim();
    if (cat.subcategories.includes(cleanSub)) return;

    const updated: LogCategoryConfig = {
      ...cat,
      subcategories: [...cat.subcategories, cleanSub],
    };

    await db.saveCategory(updated);
    p2pSyncManager.broadcastCategory(updated);
    setCategories((prev) => prev.map((c) => (c.id === cat.id ? updated : c)));
    setNewSubcatInput('');
  };

  // Remove subcategory
  const handleRemoveSubcat = async (cat: LogCategoryConfig, sub: string) => {
    const updated: LogCategoryConfig = {
      ...cat,
      subcategories: cat.subcategories.filter((s) => s !== sub),
    };
    await db.saveCategory(updated);
    p2pSyncManager.broadcastCategory(updated);
    setCategories((prev) => prev.map((c) => (c.id === cat.id ? updated : c)));
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const rate = Math.max(1, Number(rateMultiplierInput) || 120);
    const org = orgNameInput.trim() || 'Grand Hotel & Suites';

    const updated: AppSettings = {
      ...settings,
      salesRateMultiplier: rate,
      organizationName: org,
    };

    await db.saveSettings(updated);
    p2pSyncManager.broadcastSettings(updated);
    setSettings(updated);
    setSettingsSuccess(true);
    setTimeout(() => setSettingsSuccess(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full my-8 overflow-hidden border border-gray-100 dark:border-gray-700 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 via-indigo-900 to-blue-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
              <ShieldCheck className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Manager Administration Console</h2>
              <p className="text-xs text-indigo-200">
                Manage staff accounts, shift log categories & sales multipliers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6 bg-gray-50 dark:bg-gray-800/60">
          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 px-4 font-semibold text-xs border-b-2 transition flex items-center space-x-2 ${
              activeTab === 'users'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Staff Users & Roles ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`py-3 px-4 font-semibold text-xs border-b-2 transition flex items-center space-x-2 ${
              activeTab === 'categories'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Shift Log Categories</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`py-3 px-4 font-semibold text-xs border-b-2 transition flex items-center space-x-2 ${
              activeTab === 'settings'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Revenue Multiplier & Settings</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* -------------------- TAB 1: USERS -------------------- */}
          {activeTab === 'users' && (
            <div className="space-y-6 animate-fade-in">
              {/* Add User Form */}
              <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-3 flex items-center space-x-1.5">
                  <UserPlus className="w-4 h-4 text-blue-600" />
                  <span>Create New Staff Account</span>
                </h3>

                {userError && (
                  <div className="mb-3 p-2.5 bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-700 dark:text-red-300 rounded-lg text-xs flex items-center space-x-1.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{userError}</span>
                  </div>
                )}

                {userSuccess && (
                  <div className="mb-3 p-2.5 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs flex items-center space-x-1.5">
                    <Check className="w-4 h-4 flex-shrink-0" />
                    <span>{userSuccess}</span>
                  </div>
                )}

                <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Username *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. clerk2"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex Johnson"
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Role *
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="clerk">Front Desk Clerk</option>
                      <option value="manager">Manager / Admin</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Initial Password *
                    </label>
                    <div className="flex space-x-1.5">
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="submit"
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition flex-shrink-0"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Users List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Registered Staff Accounts ({users.length})
                </h4>

                <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-700/60">
                  {users.map((u) => {
                    const isSelf = u.id === currentUser.id;
                    return (
                      <div
                        key={u.id}
                        className="p-3 bg-white dark:bg-gray-800 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 transition"
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-xl ${
                            u.role === 'manager'
                              ? 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300'
                              : 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                          }`}>
                            {u.role === 'manager' ? <ShieldCheck className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-bold text-gray-900 dark:text-white">
                                {u.fullName}
                              </span>
                              <span className="text-xs text-gray-400">(@{u.username})</span>
                              {isSelf && (
                                <span className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 px-1.5 py-0.2 rounded font-bold">
                                  You
                                </span>
                              )}
                              {!u.isActive && (
                                <span className="text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200 px-1.5 py-0.2 rounded font-bold">
                                  Deactivated
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 capitalize">{u.role}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => handleToggleUserActive(u)}
                              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                                u.isActive
                                  ? 'border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300'
                                  : 'border-emerald-500 text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              {u.isActive ? 'Deactivate' : 'Reactivate'}
                            </button>
                          )}
                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id)}
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition"
                              title="Delete User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* -------------------- TAB 2: CATEGORIES -------------------- */}
          {activeTab === 'categories' && (
            <div className="space-y-6 animate-fade-in">
              {/* Add Custom Category Form */}
              <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-3 flex items-center space-x-1.5">
                  <Tag className="w-4 h-4 text-blue-600" />
                  <span>Create New Shift Log Category</span>
                </h3>

                <form onSubmit={handleAddCategory} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Category Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Maintenance, Lost & Found"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Subcategories (comma separated)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Plumbing, Electrical, HVAC"
                      value={newCatSubcats}
                      onChange={(e) => setNewCatSubcats(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition"
                    >
                      Save Category
                    </button>
                  </div>
                </form>
              </div>

              {/* Current Categories List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Configured Shift Log Categories
                </h4>

                <div className="grid grid-cols-1 gap-3">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-gray-900 dark:text-white">
                            {cat.name}
                          </span>
                          {cat.name === 'Sales' && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                              Multiplication Factor Active
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Subcategories pills */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="text-xs text-gray-400 mr-1">Subcategories:</span>
                        {cat.subcategories.map((sub) => (
                          <span
                            key={sub}
                            className="inline-flex items-center space-x-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-600"
                          >
                            <span>{sub}</span>
                            {cat.subcategories.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveSubcat(cat, sub)}
                                className="text-gray-400 hover:text-rose-500 ml-1"
                              >
                                &times;
                              </button>
                            )}
                          </span>
                        ))}

                        {/* Add subcategory button/input */}
                        {editingCatId === cat.id ? (
                          <div className="inline-flex items-center space-x-1">
                            <input
                              type="text"
                              autoFocus
                              placeholder="New subcategory..."
                              value={newSubcatInput}
                              onChange={(e) => setNewSubcatInput(e.target.value)}
                              className="px-2 py-0.5 text-xs bg-white dark:bg-gray-900 border border-blue-400 rounded-md focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                handleAddSubcatToCat(cat);
                                setEditingCatId(null);
                              }}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCatId(null)}
                              className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCatId(cat.id);
                              setNewSubcatInput('');
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center space-x-1 px-2 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            <span>Add Subcategory</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* -------------------- TAB 3: SETTINGS & RATE MULTIPLIER -------------------- */}
          {activeTab === 'settings' && (
            <div className="space-y-6 animate-fade-in max-w-xl">
              <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1 flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>Sales Lead Revenue Multiplication Factor</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  When a front desk clerk enters dates and room requirements for group/wedding leads, the system auto-calculates total nights and multiplies by this rough average daily rate ($/room-night).
                </p>

                {settingsSuccess && (
                  <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs flex items-center space-x-2">
                    <Check className="w-4 h-4 flex-shrink-0" />
                    <span>Settings saved and synchronized across all peer registers!</span>
                  </div>
                )}

                <form onSubmit={handleSaveSettings} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      Hotel / Organization Name
                    </label>
                    <input
                      type="text"
                      required
                      value={orgNameInput}
                      onChange={(e) => setOrgNameInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      Multiplication Rate ($ / Room Night)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <input
                        type="number"
                        min={1}
                        required
                        value={rateMultiplierInput}
                        onChange={(e) => setRateMultiplierInput(parseFloat(e.target.value) || 0)}
                        className="w-full pl-9 pr-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <span className="text-[11px] text-gray-400 mt-1 block">
                      Default: $120.00 / night. Example: 10 rooms × 3 nights × $120 = $3,600 potential revenue.
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition flex items-center space-x-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>Save & Broadcast Settings</span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
