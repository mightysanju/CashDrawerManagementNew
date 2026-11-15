import React, { useState, useEffect, useMemo } from 'react';
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
  PlusCircle,
  FileText,
  Database,
  Download,
  HardDrive,
  Copy,
  Calendar,
  Folder,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Search,
  Key,
  RotateCcw,
  Lock
} from 'lucide-react';
import { UserAccount, UserRole, LogCategoryConfig, AppSettings, ShiftLogEntry } from '../types';
import { DatabaseManager } from '../utils/database';
import { authManager } from '../utils/authManager';
import { p2pSyncManager } from '../utils/p2pSyncManager';
import { generateShiftLogAuditPDF, exportShiftLogsToCSV } from '../utils/pdfGenerator';
import { formatFullTimestamp } from '../utils/dateUtils';

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
  const [activeTab, setActiveTab] = useState<'users' | 'categories' | 'reports' | 'database' | 'settings'>('users');
  
  // Users state
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('clerk');
  const [userError, setUserError] = useState<string | null>(null);
  const [userSuccess, setUserSuccess] = useState<string | null>(null);
  const [resetPasswordTargetUser, setResetPasswordTargetUser] = useState<UserAccount | null>(null);
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [adminPasswordSuccess, setAdminPasswordSuccess] = useState<string | null>(null);

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

  // Reports state
  const [allShiftLogs, setAllShiftLogs] = useState<ShiftLogEntry[]>([]);
  const [reportStartDate, setReportStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [reportCategory, setReportCategory] = useState<string>('All');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Database Inspector state
  const [dbCounts, setDbCounts] = useState<Record<string, number>>({});
  const [selectedStore, setSelectedStore] = useState<string>('shift_logs');
  const [storeRecords, setStoreRecords] = useState<Record<string, unknown>[]>([]);
  const [storeFilterText, setStoreFilterText] = useState<string>('');
  const [isDbExplorerOpen, setIsDbExplorerOpen] = useState<boolean>(false);
  const [copiedPath, setCopiedPath] = useState<boolean>(false);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      try {
        const [loadedUsers, loadedCats, loadedSettings, loadedLogs, counts] = await Promise.all([
          db.getUsers(),
          db.getCategories(),
          db.getSettings(),
          db.getShiftLogs(),
          db.getStoreCounts(),
        ]);
        setUsers(loadedUsers);
        setCategories(loadedCats);
        setSettings(loadedSettings);
        setRateMultiplierInput(loadedSettings.salesRateMultiplier || 120);
        setOrgNameInput(loadedSettings.organizationName || 'Grand Hotel & Suites');
        setAllShiftLogs(loadedLogs);
        setDbCounts(counts);
      } catch (err) {
        console.error('Error loading manager data:', err);
      }
    };
    loadData();
    setUserError(null);
    setUserSuccess(null);
  }, [isOpen]);

  // Load store records when selectedStore or isDbExplorerOpen changes
  useEffect(() => {
    if (!isDbExplorerOpen) return;
    const fetchRecords = async () => {
      try {
        const records = await db.getStoreRecords(selectedStore);
        setStoreRecords(records);
      } catch (err) {
        console.error('Error loading store records:', err);
      }
    };
    fetchRecords();
  }, [selectedStore, isDbExplorerOpen]);

  // Filtered shift logs for audit reports
  const filteredLogs = useMemo(() => {
    return allShiftLogs.filter((log) => {
      if (reportStartDate) {
        const logDate = log.createdAt.split('T')[0];
        if (logDate < reportStartDate) return false;
      }
      if (reportEndDate) {
        const logDate = log.createdAt.split('T')[0];
        if (logDate > reportEndDate) return false;
      }
      if (reportCategory !== 'All' && log.category !== reportCategory) {
        return false;
      }
      return true;
    });
  }, [allShiftLogs, reportStartDate, reportEndDate, reportCategory]);

  const filteredResponsesCount = useMemo(() => {
    return filteredLogs.reduce((acc, l) => acc + (l.responses?.length || 0), 0);
  }, [filteredLogs]);

  const filteredPotentialRevenue = useMemo(() => {
    return filteredLogs
      .filter((l) => l.category === 'Sales')
      .reduce((acc, l) => acc + (l.roughRevenueEstimate || 0), 0);
  }, [filteredLogs]);

  // Filtered store records in Database Inspector
  const filteredStoreRecords = useMemo(() => {
    if (!storeFilterText.trim()) return storeRecords;
    const term = storeFilterText.toLowerCase();
    return storeRecords.filter((rec) => {
      const json = JSON.stringify(rec).toLowerCase();
      return json.includes(term);
    });
  }, [storeRecords, storeFilterText]);

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

    const existing = users.find((u) => u.username.toLowerCase() === cleanUser);
    if (existing) {
      setUserError(`Username "${cleanUser}" already exists.`);
      return;
    }

    const newUser: UserAccount = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      username: cleanUser,
      passwordHash: newPassword,
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
      const counts = await db.getStoreCounts();
      setDbCounts(counts);
    } catch (err) {
      console.error('Failed to create user:', err);
      setUserError('Failed to save user in local database.');
    }
  };

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

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUser.id) {
      alert('You cannot delete your own active account.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this staff user account?')) {
      await db.deleteUser(userId);
      p2pSyncManager.broadcastUserDelete(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      const counts = await db.getStoreCounts();
      setDbCounts(counts);
    }
  };

  const handleResetPasswordToDefault = async (user: UserAccount) => {
    const defaultPassword = user.role === 'manager' ? 'password123' : 'clerk123';
    const updated: UserAccount = {
      ...user,
      passwordHash: defaultPassword,
    };

    try {
      await db.saveUser(updated);
      if (user.id === currentUser.id) {
        authManager.updateCurrentUser(updated);
      }
      p2pSyncManager.broadcastUser(updated);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
      setResetPasswordTargetUser(updated);
      setAdminPasswordSuccess(`Password for @${user.username} successfully reset to default: "${defaultPassword}"`);
    } catch (err) {
      console.error('Failed to reset password:', err);
      alert('Failed to reset password in local database.');
    }
  };

  const handleSetCustomPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordTargetUser) return;
    if (!adminNewPassword || adminNewPassword.length < 4) {
      alert('Password must be at least 4 characters long.');
      return;
    }

    const updated: UserAccount = {
      ...resetPasswordTargetUser,
      passwordHash: adminNewPassword,
    };

    try {
      await db.saveUser(updated);
      if (resetPasswordTargetUser.id === currentUser.id) {
        authManager.updateCurrentUser(updated);
      }
      p2pSyncManager.broadcastUser(updated);
      setUsers((prev) => prev.map((u) => (u.id === resetPasswordTargetUser.id ? updated : u)));
      setResetPasswordTargetUser(updated);
      setAdminPasswordSuccess(`Password for @${resetPasswordTargetUser.username} successfully updated to: "${adminNewPassword}"`);
      setAdminNewPassword('');
    } catch (err) {
      console.error('Failed to update password:', err);
      alert('Failed to update password in local database.');
    }
  };

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
    const counts = await db.getStoreCounts();
    setDbCounts(counts);
  };

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

  const handleRemoveSubcat = async (cat: LogCategoryConfig, sub: string) => {
    const updated: LogCategoryConfig = {
      ...cat,
      subcategories: cat.subcategories.filter((s) => s !== sub),
    };
    await db.saveCategory(updated);
    p2pSyncManager.broadcastCategory(updated);
    setCategories((prev) => prev.map((c) => (c.id === cat.id ? updated : c)));
  };

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

  // Date range presets helper
  const handleApplyPreset = (preset: 'today' | '7days' | '30days' | 'all') => {
    const today = new Date().toISOString().split('T')[0];
    if (preset === 'today') {
      setReportStartDate(today);
      setReportEndDate(today);
    } else if (preset === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setReportStartDate(d.toISOString().split('T')[0]);
      setReportEndDate(today);
    } else if (preset === '30days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setReportStartDate(d.toISOString().split('T')[0]);
      setReportEndDate(today);
    } else if (preset === 'all') {
      setReportStartDate('');
      setReportEndDate(today);
    }
  };

  // Export Full Database Dump (.json)
  const handleExportDatabaseDump = async () => {
    try {
      const dump = await db.exportFullDatabaseDump();
      const jsonStr = JSON.stringify(dump, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cash_drawer_db_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting database dump:', err);
      alert('Failed to generate database dump.');
    }
  };

  // Local database disk path detection
  const detectedOrigin = window.location.origin.replace('://', '_');
  const macPath = `~/Library/Application Support/Google/Chrome/Default/IndexedDB/${detectedOrigin}_0.indexeddb.leveldb/`;
  const winPath = `%LocalAppData%\\Google\\Chrome\\User Data\\Default\\IndexedDB\\${detectedOrigin}_0.indexeddb.leveldb\\`;

  const handleCopyPath = () => {
    navigator.clipboard.writeText(macPath);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full my-6 overflow-hidden border border-gray-100 dark:border-gray-700 flex flex-col max-h-[92vh] transition-colors">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 via-indigo-900 to-blue-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
              <ShieldCheck className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Manager Administration Console</h2>
              <p className="text-xs text-indigo-200">
                Staff accounts, log categories, date-range audit reports & local database explorer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6 bg-gray-50 dark:bg-gray-800/60 overflow-x-auto">
          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 px-3.5 font-semibold text-xs border-b-2 transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'users'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Staff Users ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`py-3 px-3.5 font-semibold text-xs border-b-2 transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'categories'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Shift Log Categories</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`py-3 px-3.5 font-semibold text-xs border-b-2 transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'reports'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-bold">Reports & Shift Audits ({allShiftLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('database')}
            className={`py-3 px-3.5 font-semibold text-xs border-b-2 transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'database'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="font-bold">Local Database & Storage</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`py-3 px-3.5 font-semibold text-xs border-b-2 transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'settings'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
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
                      placeholder="e.g. jsmith"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Full Staff Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Smith"
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Password *
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Enter secure password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Role
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="clerk">Front Desk Clerk</option>
                      <option value="manager">Property Manager</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 md:col-span-4 flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-sm"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Save & Sync Staff User</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Users List */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
                  Active Staff Accounts ({users.length})
                </h3>
                <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="p-3.5 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-gray-750 transition"
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            user.role === 'manager'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                          }`}
                        >
                          {user.role === 'manager' ? (
                            <ShieldCheck className="w-4 h-4" />
                          ) : (
                            user.fullName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-xs text-gray-900 dark:text-white">
                              {user.fullName}
                            </span>
                            <span className="text-[11px] text-gray-400 font-mono">
                              (@{user.username})
                            </span>
                            <span
                              className={`text-[10px] font-bold uppercase px-1.5 py-0.2 rounded border ${
                                user.role === 'manager'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:border-purple-800'
                                  : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800'
                              }`}
                            >
                              {user.role}
                            </span>
                            {!user.isActive && (
                              <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.2 rounded font-semibold">
                                Deactivated
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            Created: {new Date(user.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setResetPasswordTargetUser(user);
                            setAdminNewPassword('');
                            setAdminPasswordSuccess(null);
                          }}
                          className="text-[11px] font-semibold px-2 py-1 rounded-md text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition flex items-center space-x-1 cursor-pointer"
                          title="Change or Reset User Password"
                        >
                          <Key className="w-3.5 h-3.5" />
                          <span>Password</span>
                        </button>
                        <button
                          onClick={() => handleToggleUserActive(user)}
                          className={`text-[11px] font-semibold px-2 py-1 rounded-md transition ${
                            user.isActive
                              ? 'text-gray-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                              : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                          }`}
                        >
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        {user.id !== currentUser.id && (
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition cursor-pointer"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Admin Manage User Password Modal */}
              {resetPasswordTargetUser && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 dark:border-slate-800">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-5 py-3.5 text-white flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Key className="w-4 h-4 text-blue-200" />
                        <h4 className="text-sm font-bold">Manage User Password</h4>
                      </div>
                      <button
                        onClick={() => setResetPasswordTargetUser(null)}
                        className="p-1 text-blue-100 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-5 space-y-4">
                      <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            {resetPasswordTargetUser.fullName}
                          </span>
                          <span className="text-[11px] text-gray-400 font-mono">
                            (@{resetPasswordTargetUser.username})
                          </span>
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            {resetPasswordTargetUser.role}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          Current Stored Password: <code className="text-blue-600 dark:text-blue-400 font-mono font-bold bg-blue-50 dark:bg-slate-750 px-1.5 py-0.5 rounded">{resetPasswordTargetUser.passwordHash}</code>
                        </p>
                      </div>

                      {adminPasswordSuccess && (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs flex items-center space-x-2">
                          <Check className="w-4 h-4 shrink-0" />
                          <span>{adminPasswordSuccess}</span>
                        </div>
                      )}

                      {/* Option 1: 1-Click Reset to Default */}
                      <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-2">
                        <div className="flex items-center space-x-1.5 text-amber-800 dark:text-amber-300 text-xs font-bold">
                          <RotateCcw className="w-4 h-4" />
                          <span>Option 1: One-Click Reset to Default Password</span>
                        </div>
                        <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                          Reset password back to standard system default: 
                          <strong className="ml-1 font-mono">{resetPasswordTargetUser.role === 'manager' ? 'password123' : 'clerk123'}</strong>
                        </p>
                        <button
                          type="button"
                          onClick={() => handleResetPasswordToDefault(resetPasswordTargetUser)}
                          className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset to Default ({resetPasswordTargetUser.role === 'manager' ? 'password123' : 'clerk123'})</span>
                        </button>
                      </div>

                      {/* Option 2: Set Custom Password */}
                      <form onSubmit={handleSetCustomPassword} className="space-y-3 pt-1 border-t border-gray-100 dark:border-slate-800">
                        <div>
                          <label className="block text-xs font-bold text-slate-800 dark:text-white mb-1">
                            Option 2: Assign Custom Password
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Enter new custom password (min 4 chars)"
                            value={adminNewPassword}
                            onChange={(e) => setAdminNewPassword(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => setResetPasswordTargetUser(null)}
                            className="px-3.5 py-2 border border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            Done
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Set Custom Password</span>
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* -------------------- TAB 2: CATEGORIES -------------------- */}
          {activeTab === 'categories' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-3 flex items-center space-x-1.5">
                  <Tag className="w-4 h-4 text-blue-600" />
                  <span>Create Custom Category</span>
                </h3>
                <form onSubmit={handleAddCategory} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Category Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Maintenance"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Subcategories (comma separated)
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="e.g. Plumbing, HVAC, Electrical, Keycard"
                        value={newCatSubcats}
                        onChange={(e) => setNewCatSubcats(e.target.value)}
                        className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-sm whitespace-nowrap"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Add Category</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Categories Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Tag className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <h4 className="font-bold text-xs text-gray-900 dark:text-white">
                          {cat.name}
                        </h4>
                      </div>
                      <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full font-semibold">
                        {cat.subcategories.length} subcategories
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {cat.subcategories.map((sub) => (
                        <span
                          key={sub}
                          className="inline-flex items-center space-x-1 text-[11px] bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-md"
                        >
                          <span>{sub}</span>
                          {cat.subcategories.length > 1 && (
                            <button
                              onClick={() => handleRemoveSubcat(cat, sub)}
                              className="hover:text-rose-600 ml-1 cursor-pointer"
                              title="Remove subcategory"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>

                    {editingCatId === cat.id ? (
                      <div className="flex items-center space-x-1.5 pt-2 border-t border-gray-100 dark:border-gray-700">
                        <input
                          type="text"
                          placeholder="New subcategory..."
                          value={newSubcatInput}
                          onChange={(e) => setNewSubcatInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddSubcatToCat(cat);
                            }
                          }}
                          className="flex-1 px-2 py-1 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => handleAddSubcatToCat(cat)}
                          className="px-2 py-1 bg-blue-600 text-white text-xs rounded-md font-bold"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setEditingCatId(null)}
                          className="px-2 py-1 text-gray-400 text-xs hover:text-gray-600"
                        >
                          Done
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingCatId(cat.id);
                          setNewSubcatInput('');
                        }}
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center space-x-1"
                      >
                        <PlusCircle className="w-3 h-3" />
                        <span>Add Subcategory</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* -------------------- TAB 3: REPORTS & SHIFT AUDITS -------------------- */}
          {activeTab === 'reports' && (
            <div className="space-y-6 animate-fade-in">
              {/* Filter & Controls Card */}
              <div className="bg-slate-50 dark:bg-gray-750 p-4 rounded-xl border border-slate-200 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white flex items-center space-x-1.5">
                      <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Select Date Range & Category for Audit Report</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">
                      Download full shift log histories including every clerk note and all staff follow-up responses.
                    </p>
                  </div>

                  {/* Preset quick buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('today')}
                      className="px-2 py-1 text-[11px] font-semibold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 text-gray-700 dark:text-gray-200 shadow-xs cursor-pointer"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('7days')}
                      className="px-2 py-1 text-[11px] font-semibold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 text-gray-700 dark:text-gray-200 shadow-xs cursor-pointer"
                    >
                      Last 7 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('30days')}
                      className="px-2 py-1 text-[11px] font-semibold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 text-gray-700 dark:text-gray-200 shadow-xs cursor-pointer"
                    >
                      Last 30 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('all')}
                      className="px-2 py-1 text-[11px] font-semibold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 text-gray-700 dark:text-gray-200 shadow-xs cursor-pointer"
                    >
                      All Time
                    </button>
                  </div>
                </div>

                {/* Date Inputs & Category Select */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-gray-300 mb-1">
                      From Date
                    </label>
                    <input
                      type="date"
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-gray-300 mb-1">
                      To Date
                    </label>
                    <input
                      type="date"
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-gray-300 mb-1">
                      Filter Category
                    </label>
                    <select
                      value={reportCategory}
                      onChange={(e) => setReportCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="All">All Categories</option>
                      <option value="Sales">Sales Leads Only</option>
                      <option value="Complaint">Complaints Only</option>
                      <option value="Miscellaneous">Miscellaneous Only</option>
                    </select>
                  </div>
                </div>

                {/* Metrics Summary Strip */}
                <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-slate-200 dark:border-gray-700 text-center">
                  <div className="bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-slate-200 dark:border-gray-700">
                    <span className="text-[10px] text-gray-400 uppercase font-bold block">Matched Logs</span>
                    <span className="text-base font-extrabold text-slate-900 dark:text-white">{filteredLogs.length}</span>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-slate-200 dark:border-gray-700">
                    <span className="text-[10px] text-gray-400 uppercase font-bold block">Actions & Responses</span>
                    <span className="text-base font-extrabold text-blue-600 dark:text-blue-400">{filteredResponsesCount}</span>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-slate-200 dark:border-gray-700">
                    <span className="text-[10px] text-gray-400 uppercase font-bold block">Pipeline Revenue</span>
                    <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">${filteredPotentialRevenue.toLocaleString()}</span>
                  </div>
                </div>

                {/* Download Actions */}
                <div className="flex flex-wrap items-center justify-end gap-3 mt-4 pt-3 border-t border-slate-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => exportShiftLogsToCSV(filteredLogs, reportStartDate, reportEndDate)}
                    disabled={filteredLogs.length === 0}
                    className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Download CSV Spreadsheet</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => generateShiftLogAuditPDF(filteredLogs, reportStartDate, reportEndDate, orgNameInput || settings.organizationName || 'FrontDesk Pro')}
                    disabled={filteredLogs.length === 0}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Download Shift Log Audit Report (PDF)</span>
                  </button>
                </div>
              </div>

              {/* Preview Table of Filtered Logs */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300 mb-2 flex items-center justify-between">
                  <span>Report Preview ({filteredLogs.length} entries)</span>
                  <span className="text-[10px] font-normal text-gray-400">Click entry to expand full thread</span>
                </h4>

                {filteredLogs.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 dark:bg-gray-750 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-400 text-xs">
                    No logs match the chosen date range and category. Try expanding the date filter.
                  </div>
                ) : (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                    {filteredLogs.slice(0, 50).map((log) => {
                      const isExpanded = expandedLogId === log.id;
                      const responseCount = log.responses?.length || 0;
                      return (
                        <div key={log.id} className="p-3.5 hover:bg-slate-50/50 dark:hover:bg-gray-750 transition">
                          <div
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="flex items-center justify-between cursor-pointer"
                          >
                            <div className="flex items-center space-x-3">
                              <span
                                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                                  log.category === 'Sales'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : log.category === 'Complaint'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300'
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300'
                                }`}
                              >
                                {log.category}
                              </span>
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                                    {log.name || log.topic}
                                  </span>
                                  {log.subCategory && (
                                    <span className="text-[10px] text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.2 rounded">
                                      {log.subCategory}
                                    </span>
                                  )}
                                  {log.roomNumber && (
                                    <span className="text-[10px] text-gray-500">Room {log.roomNumber}</span>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2 text-[10px] text-gray-400 mt-0.5 font-mono">
                                  <span>{formatFullTimestamp(log.createdAt)}</span>
                                  <span>•</span>
                                  <span>by {log.clerkName} ({log.clerkRole})</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-3">
                              {responseCount > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                                  <MessageSquare className="w-3 h-3" />
                                  <span>{responseCount} actions</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-400">0 responses</span>
                              )}
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                            </div>
                          </div>

                          {/* Expanded detail & responses history */}
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 pl-4 space-y-2 text-xs">
                              {log.clerkNotes && (
                                <div className="bg-slate-50 dark:bg-gray-700/50 p-2.5 rounded-lg border border-slate-200 dark:border-gray-600">
                                  <span className="text-[10px] uppercase font-bold text-gray-500 block mb-0.5">Initial Clerk Notes:</span>
                                  <p className="text-gray-800 dark:text-gray-200">{log.clerkNotes}</p>
                                </div>
                              )}

                              <div>
                                <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
                                  Actions & Threaded Response History:
                                </span>
                                {responseCount > 0 ? (
                                  <div className="space-y-1.5">
                                    {log.responses!.map((r) => (
                                      <div key={r.id} className="p-2 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs">
                                        <div className="flex items-center justify-between mb-0.5">
                                          <span className="font-bold text-gray-900 dark:text-white">
                                            {r.authorName} <span className="text-[10px] text-gray-400 font-normal">({r.authorRole})</span>
                                          </span>
                                          <span className="text-[10px] font-mono text-gray-500">{formatFullTimestamp(r.createdAt)}</span>
                                        </div>
                                        <p className="text-gray-700 dark:text-gray-300">{r.message}</p>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-gray-400 italic text-[11px]">No follow-up actions or clerk replies recorded for this entry.</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* -------------------- TAB 4: LOCAL DATABASE & STORAGE -------------------- */}
          {activeTab === 'database' && (
            <div className="space-y-6 animate-fade-in">
              {/* Local Storage Location & Engine Banner */}
              <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start space-x-3">
                    <div className="p-2.5 bg-blue-600/30 text-blue-400 rounded-xl border border-blue-500/30">
                      <HardDrive className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-bold text-white tracking-wide">
                          Client-Side Local Database (IndexedDB)
                        </h3>
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          100% Private & On-Device
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                        All cash shifts, group sales leads, guest complaints, and staff credentials reside in your browser's persistent local storage engine (<code className="text-blue-300">cash_drawer_db</code>, version 4). No guest or financial data is ever sent to external cloud servers.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportDatabaseDump}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer whitespace-nowrap self-start"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Full DB (.json)</span>
                  </button>
                </div>

                {/* Disk File Paths */}
                <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="font-semibold flex items-center space-x-1.5">
                      <Folder className="w-3.5 h-3.5 text-amber-400" />
                      <span>Physical Disk Location on macOS / Linux / Windows:</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPath}
                      className="inline-flex items-center space-x-1 text-blue-400 hover:text-blue-300 text-[11px] font-semibold cursor-pointer"
                    >
                      {copiedPath ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Path Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Disk Path</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 break-all select-all">
                    {macPath}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Windows equivalent: <code className="text-slate-300">{winPath}</code>
                  </div>
                </div>

                {/* Browser Inspector Tip */}
                <div className="mt-3 p-2.5 bg-slate-800/80 rounded-lg text-[11px] text-slate-300 flex items-center justify-between">
                  <span>
                    💡 <strong>Direct Browser DevTools View:</strong> Press <kbd className="bg-slate-700 px-1.5 py-0.5 rounded text-white text-[10px]">F12</kbd> (or <kbd className="bg-slate-700 px-1.5 py-0.5 rounded text-white text-[10px]">Cmd+Option+I</kbd>) &rarr; <strong>Application</strong> tab &rarr; <strong>IndexedDB</strong> &rarr; <code className="text-blue-300">cash_drawer_db</code>.
                  </span>
                </div>
              </div>

              {/* 1-Click Database Explorer Button & Container */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white flex items-center space-x-1.5">
                      <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>One-Click Database Explorer</span>
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      Browse and inspect live records across all 6 local object stores in real time.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsDbExplorerOpen(!isDbExplorerOpen)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm cursor-pointer whitespace-nowrap self-start"
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>{isDbExplorerOpen ? 'Hide Database Explorer' : 'Open Database Explorer'}</span>
                  </button>
                </div>

                {/* Object Store Summary Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mb-4">
                  {[
                    { key: 'shift_logs', label: 'Shift Logs', count: dbCounts.shift_logs || 0 },
                    { key: 'shifts', label: 'Cash Shifts', count: dbCounts.shifts || 0 },
                    { key: 'users', label: 'Staff Users', count: dbCounts.users || 0 },
                    { key: 'log_categories', label: 'Categories', count: dbCounts.log_categories || 0 },
                    { key: 'app_settings', label: 'Settings', count: dbCounts.app_settings || 0 },
                    { key: 'organization', label: 'Organization', count: dbCounts.organization || 0 },
                  ].map((store) => (
                    <button
                      key={store.key}
                      type="button"
                      onClick={() => {
                        setSelectedStore(store.key);
                        setIsDbExplorerOpen(true);
                      }}
                      className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                        selectedStore === store.key && isDbExplorerOpen
                          ? 'bg-indigo-50 border-indigo-400 dark:bg-indigo-950/60 dark:border-indigo-600 text-indigo-900 dark:text-indigo-200 shadow-xs'
                          : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      <span className="text-[10px] uppercase font-bold block text-gray-500 dark:text-gray-400">
                        {store.label}
                      </span>
                      <span className="text-base font-extrabold block mt-0.5">
                        {store.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Live Records Viewer */}
                {isDbExplorerOpen && (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50/50 dark:bg-gray-750 space-y-3 animate-fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                          Object Store: <code className="text-indigo-600 dark:text-indigo-400">{selectedStore}</code>
                        </span>
                        <span className="text-[11px] text-gray-500">
                          ({filteredStoreRecords.length} records)
                        </span>
                      </div>

                      <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search in store JSON..."
                          value={storeFilterText}
                          onChange={(e) => setStoreFilterText(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    {filteredStoreRecords.length === 0 ? (
                      <div className="text-center py-6 text-gray-400 text-xs italic">
                        No records stored in this table yet.
                      </div>
                    ) : (
                      <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                        {filteredStoreRecords.map((record, index) => {
                          const recordId = record.id || record.username || index;
                          const isExpanded = expandedRecordId === String(recordId);
                          return (
                            <div
                              key={String(recordId)}
                              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2.5 text-xs shadow-xs"
                            >
                              <div
                                onClick={() => setExpandedRecordId(isExpanded ? null : String(recordId))}
                                className="flex items-center justify-between cursor-pointer"
                              >
                                <div className="flex items-center space-x-2 truncate">
                                  <span className="font-mono text-[10px] text-gray-400">#{index + 1}</span>
                                  <span className="font-bold text-gray-800 dark:text-gray-200 truncate">
                                    {record.name || record.topic || record.fullName || record.id || JSON.stringify(record).substring(0, 40)}
                                  </span>
                                  {record.createdAt && (
                                    <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">
                                      {formatFullTimestamp(record.createdAt)}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                                    {isExpanded ? 'Collapse' : 'Inspect JSON'}
                                  </span>
                                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                                </div>
                              </div>

                              {isExpanded && (
                                <pre className="mt-2 p-2 bg-slate-900 text-slate-100 rounded text-[10px] font-mono overflow-x-auto max-h-48 border border-slate-800">
                                  {JSON.stringify(record, null, 2)}
                                </pre>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* -------------------- TAB 5: SETTINGS -------------------- */}
          {activeTab === 'settings' && (
            <div className="space-y-6 animate-fade-in max-w-lg">
              <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-3 flex items-center space-x-1.5">
                  <Settings className="w-4 h-4 text-blue-600" />
                  <span>Platform & Multiplier Settings</span>
                </h3>

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
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition flex items-center space-x-2 cursor-pointer"
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
