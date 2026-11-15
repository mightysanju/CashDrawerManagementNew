import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { 
  Clock, 
  History, 
  Printer, 
  FileText, 
  Wifi, 
  Coins, 
  Bell, 
  ShieldCheck, 
  User, 
  LogOut, 
  LogIn, 
  AlertCircle,
  Puzzle
} from 'lucide-react';
import { CashEntry, ShiftRecord, ShiftLogEntry, UserAccount, PrimaryCategory } from '../types';
import { ShiftHistory } from './ShiftHistory';
import { DatabaseManager } from '../utils/database';
import { CashSection } from './cash-sections/CashSection';
import { ReceiptsSection } from './cash-sections/ReceiptsSection';
import { ActiveDrawers } from './ActiveDrawers';
import { DrawerControls } from './DrawerControls';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { NetworkSyncModal } from './NetworkSyncModal';
import { LoginModal } from './LoginModal';
import { ShiftLogModal } from './ShiftLogModal';
import { ShiftLogDashboard } from './ShiftLogDashboard';
import { RemindersTab } from './RemindersTab';
import { UserManagementModal } from './UserManagementModal';
import { ExtensionModal } from './ExtensionModal';
import { FloatingExtensionBubble } from './FloatingExtensionBubble';
import { generatePDF, printReceipt } from '../utils/pdfGenerator';
import { p2pSyncManager, SyncState } from '../utils/p2pSyncManager';
import { authManager } from '../utils/authManager';

const DENOMINATIONS = {
  bill: [100, 50, 20, 10, 5, 1],
  coin: [1, 0.25, 0.10, 0.05, 0.01],
  roll: [10, 5, 2, 1, 0.5],
};

const db = new DatabaseManager();

type AppTab = 'register' | 'logs' | 'reminders' | 'admin';

export function CashDrawer() {
  // Navigation tab state
  const [activeTab, setActiveTab] = useState<AppTab>('register');

  // Authentication State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(authManager.getCurrentUser());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginRequiredAction, setLoginRequiredAction] = useState<string | null>(null);

  // Shift & Drawer State
  const [organizationName, setOrganizationName] = useState('');
  const [drawerNumber, setDrawerNumber] = useState('');
  const [cashierName, setCashierName] = useState(currentUser?.fullName || '');
  const [activeShifts, setActiveShifts] = useState<ShiftRecord[]>([]);
  const [selectedShift, setSelectedShift] = useState<ShiftRecord | null>(null);
  const [shiftHistory, setShiftHistory] = useState<ShiftRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [shiftDrop, setShiftDrop] = useState<number>(0);

  // Shift Logs & Reminders State
  const [shiftLogs, setShiftLogs] = useState<ShiftLogEntry[]>([]);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [editingLogEntry, setEditingLogEntry] = useState<ShiftLogEntry | null>(null);
  const [defaultLogCat, setDefaultLogCat] = useState<PrimaryCategory>('Sales');

  // Modals
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isUserMgmtModalOpen, setIsUserMgmtModalOpen] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>(p2pSyncManager.getState());

  // Browser Extension & Floating Bubble States
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);
  const [isFloatingBubbleEnabled, setIsFloatingBubbleEnabled] = useState(true);
  const [isFloatingBubbleOpen, setIsFloatingBubbleOpen] = useState(false);

  // Load shifts and settings from IndexedDB
  const loadShiftsData = useCallback(async () => {
    try {
      const allShifts = await db.getAllShifts();
      const active = allShifts.filter((shift) => shift.status === 'open');
      const closed = allShifts.filter((shift) => shift.status === 'closed');

      setActiveShifts(active);
      setShiftHistory(closed);

      setSelectedShift((prevSelected) => {
        if (prevSelected) {
          const updated = active.find((s) => s.id === prevSelected.id);
          if (updated) {
            setEntries(updated.entries);
            setShiftDrop(updated.shiftDrop || 0);
            return updated;
          }
        }
        if (active.length > 0) {
          setEntries(active[0].entries);
          setShiftDrop(active[0].shiftDrop || 0);
          setOrganizationName(active[0].organizationName || '');
          setDrawerNumber(active[0].drawerNumber);
          setCashierName(active[0].cashierName);
          return active[0];
        }
        return null;
      });
    } catch (error) {
      console.error('Error loading shifts data:', error);
    }
  }, []);

  // Load shift logs from IndexedDB
  const loadLogsData = useCallback(async () => {
    try {
      const logs = await db.getShiftLogs();
      setShiftLogs(logs);
    } catch (error) {
      console.error('Error loading shift logs:', error);
    }
  }, []);

  useEffect(() => {
    loadShiftsData();
    loadLogsData();

    // Auto-discover and connect immediately on startup
    p2pSyncManager.autoConnect();

    // Subscribe to auth changes
    const unsubAuth = authManager.subscribe((user) => {
      setCurrentUser(user);
      if (user && !cashierName) {
        setCashierName(user.fullName);
      }
    });

    // Listen for P2P network changes and remote sync payloads
    const unsubState = p2pSyncManager.subscribeState(setSyncState);
    const unsubData = p2pSyncManager.subscribeData(() => {
      loadShiftsData();
      loadLogsData();
    });

    return () => {
      unsubAuth();
      unsubState();
      unsubData();
    };
  }, [loadShiftsData, loadLogsData, cashierName]);

  // Reminders metrics
  const pendingRemindersCount = shiftLogs.filter(
    (l) => l.hasReminder && !l.isReminderCompleted
  ).length;

  const handleSelectShift = (shift: ShiftRecord) => {
    setSelectedShift(shift);
    setEntries(shift.entries);
    setOrganizationName(shift.organizationName || '');
    setDrawerNumber(shift.drawerNumber);
    setCashierName(shift.cashierName);
  };

  const handleStartShift = async (openingEntries: CashEntry[]) => {
    // Authentication guard: Clerk or Manager must be signed in
    if (!currentUser) {
      setLoginRequiredAction('start-shift');
      setIsLoginModalOpen(true);
      return;
    }

    if (!drawerNumber || !cashierName) {
      alert('Please enter both drawer number and cashier name.');
      return;
    }

    if (activeShifts.some((shift) => shift.drawerNumber === drawerNumber)) {
      alert(
        'This drawer number is already in use. Please select a different number or close the active shift.'
      );
      return;
    }

    try {
      const openingBalance = openingEntries.reduce(
        (sum, entry) => sum + entry.total,
        0
      );

      const newShift: ShiftRecord = {
        id: Date.now().toString(),
        organizationName,
        drawerNumber,
        cashierName: cashierName.trim() || currentUser.fullName,
        cashierId: currentUser.id,
        openTime: new Date().toISOString(),
        openingBalance,
        entries: openingEntries,
        status: 'open',
      };

      await db.saveShift(newShift);
      p2pSyncManager.broadcastShift(newShift);

      await loadShiftsData();
      handleSelectShift(newShift);

      // Clear form
      setDrawerNumber('');
      setCashierName(currentUser.fullName);
    } catch (error) {
      console.error('Error starting shift:', error);
      alert('Failed to start shift. Please try again.');
    }
  };

  const handleEndShift = async () => {
    if (!currentUser) {
      setLoginRequiredAction('end-shift');
      setIsLoginModalOpen(true);
      return;
    }

    if (!selectedShift) return;

    const currentBalance = calculateTotal();
    const difference = currentBalance - selectedShift.openingBalance;

    const confirmMessage = `
Shift Summary for Drawer #${selectedShift.drawerNumber}
Cashier: ${selectedShift.cashierName} (Logged as: ${currentUser.fullName})
---------------------------------
Opening Float:    $${selectedShift.openingBalance.toFixed(2)}
Counted Balance:  $${currentBalance.toFixed(2)}
Shift Drop:       $${shiftDrop.toFixed(2)}
Variance:         ${difference >= 0 ? '+' : ''}$${difference.toFixed(2)}

Close this shift, record the cash drop, and generate receipt?
    `;

    if (!window.confirm(confirmMessage.trim())) {
      return;
    }

    try {
      const closedShift: ShiftRecord = {
        ...selectedShift,
        closeTime: new Date().toISOString(),
        closingBalance: currentBalance,
        shiftDrop,
        entries: [...entries],
        status: 'closed',
      };

      await db.saveShift(closedShift);
      p2pSyncManager.broadcastShift(closedShift);

      // Download PDF report
      setTimeout(() => {
        generatePDF(closedShift);
      }, 100);

      setSelectedShift(null);
      setEntries([]);
      setShiftDrop(0);
      await loadShiftsData();
    } catch (error) {
      console.error('Error ending shift:', error);
      alert('Failed to end shift. Please try again.');
    }
  };

  const calculateTotal = () =>
    entries.reduce((sum, entry) => sum + entry.total, 0);

  const updateEntry = (
    type: CashEntry['type'],
    denomination: number,
    quantity: number
  ) => {
    const total = denomination * quantity;
    const existingIndex = entries.findIndex(
      (entry) => entry.type === type && entry.denomination === denomination
    );

    let updatedEntries: CashEntry[] = [];
    if (existingIndex >= 0) {
      updatedEntries = [...entries];
      updatedEntries[existingIndex] = { type, denomination, quantity, total };
    } else {
      updatedEntries = [
        ...entries,
        { type, denomination, quantity, total },
      ];
    }

    setEntries(updatedEntries);
    if (selectedShift) {
      const updatedShift: ShiftRecord = {
        ...selectedShift,
        entries: updatedEntries,
      };
      db.saveShift(updatedShift);
      p2pSyncManager.broadcastShift(updatedShift);
    }
  };

  const currentTotal = calculateTotal();
  const currentDifference = selectedShift ? currentTotal - selectedShift.openingBalance : 0;

  // Shift Log Modal Handlers
  const handleOpenNewLogModal = (category: PrimaryCategory = 'Sales') => {
    if (!currentUser) {
      setLoginRequiredAction('create-log');
      setIsLoginModalOpen(true);
      return;
    }
    setEditingLogEntry(null);
    setDefaultLogCat(category);
    setIsLogModalOpen(true);
  };

  const handleEditLog = (entry: ShiftLogEntry) => {
    if (!currentUser) {
      setLoginRequiredAction('edit-log');
      setIsLoginModalOpen(true);
      return;
    }
    setEditingLogEntry(entry);
    setIsLogModalOpen(true);
  };

  const handleDeleteLog = async (logId: string) => {
    try {
      await db.deleteShiftLog(logId);
      p2pSyncManager.broadcastShiftLogDelete(logId);
      loadLogsData();
    } catch (err) {
      console.error('Error deleting shift log:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between pt-16">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow">
        {/* -------------------- MAIN APP HEADER & USER PROFILE BAR -------------------- */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                Front Desk Operations & Register
              </h1>
              {syncState.status === 'connected' && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Network P2P Connected" />
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Cash drawer reconciliation, group sales leads, guest complaints, and shift logs.
            </p>
          </div>

          {/* User Authentication & Network Badges */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-start lg:justify-end">
            {/* Staff User Profile Badge */}
            {currentUser ? (
              <div className="flex items-center space-x-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-xs">
                <div className={`p-1.5 rounded-md ${
                  currentUser.role === 'manager'
                    ? 'bg-slate-100 text-slate-800'
                    : 'bg-blue-50 text-blue-700'
                }`}>
                  {currentUser.role === 'manager' ? <ShieldCheck className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>
                <div className="text-left">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-semibold text-gray-900">
                      {currentUser.fullName}
                    </span>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.2 rounded border ${
                      currentUser.role === 'manager'
                        ? 'bg-slate-50 text-slate-700 border-slate-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {currentUser.role}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400 block">Logged In</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    authManager.logout();
                  }}
                  title="Sign Out"
                  className="ml-1 p-1 text-gray-400 hover:text-rose-600 rounded-lg transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setLoginRequiredAction(null);
                  setIsLoginModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm transition"
              >
                <LogIn className="w-4 h-4" />
                <span>Staff Sign In</span>
              </button>
            )}

            {/* P2P Network Sync Button */}
            <button
              type="button"
              onClick={() => setIsSyncModalOpen(true)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 border rounded-xl text-xs font-semibold transition shadow-xs ${
                syncState.status === 'connected'
                  ? 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100'
                  : syncState.status === 'scanning'
                    ? 'bg-amber-50 text-amber-700 border-amber-300 animate-pulse'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Wifi size={15} className={syncState.status === 'connected' ? 'text-green-600 animate-pulse' : ''} />
              {syncState.status === 'connected' ? (
                syncState.role === 'hub' ? (
                  syncState.connectedCount === 0
                    ? 'Sync: Main Register'
                    : `Sync: Hub (${syncState.connectedCount} peer${syncState.connectedCount > 1 ? 's' : ''})`
                ) : (
                  'Sync: Connected Till'
                )
              ) : syncState.status === 'scanning' ? (
                'Sync: Scanning...'
              ) : (
                'Connect Registers'
              )}
            </button>

            {/* Browser Extension Button */}
            <button
              type="button"
              onClick={() => setIsExtensionModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-xl text-xs font-semibold transition shadow-xs"
              title="Get FrontDesk Pro Browser Extension for floating shift logs"
            >
              <Puzzle size={15} className="text-blue-600" />
              <span>Browser Extension</span>
              <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.2 rounded-full">Extension</span>
            </button>
          </div>
        </div>

        {/* -------------------- NAVIGATION TABS BAR -------------------- */}
        <div className="flex flex-wrap items-center gap-2 mb-6 bg-gray-100 p-1 rounded-xl border border-gray-200/80">
          <button
            onClick={() => setActiveTab('register')}
            className={`flex-1 py-2 px-3.5 rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all ${
              activeTab === 'register'
                ? 'bg-white text-gray-900 shadow-xs border border-gray-200/60'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
            }`}
          >
            <Coins className="w-4 h-4 text-blue-600" />
            <span>Cash Register & Tills</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex-1 py-2 px-3.5 rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all ${
              activeTab === 'logs'
                ? 'bg-white text-gray-900 shadow-xs border border-gray-200/60'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
            }`}
          >
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>Shift Logs & Leads ({shiftLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('reminders')}
            className={`flex-1 py-2 px-3.5 rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all relative ${
              activeTab === 'reminders'
                ? 'bg-white text-gray-900 shadow-xs border border-gray-200/60'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
            }`}
          >
            <Bell className="w-4 h-4 text-amber-500" />
            <span>Reminders</span>
            {pendingRemindersCount > 0 && (
              <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                activeTab === 'reminders'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-rose-600 text-white'
              }`}>
                {pendingRemindersCount}
              </span>
            )}
          </button>

          {currentUser?.role === 'manager' && (
            <button
              onClick={() => setIsUserMgmtModalOpen(true)}
              className="py-2 px-3.5 rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center space-x-1.5 text-gray-700 bg-white hover:bg-gray-50 transition border border-gray-300 shadow-xs"
            >
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Manager Console</span>
            </button>
          )}
        </div>

        {/* -------------------- TAB 1: CASH REGISTER -------------------- */}
        {activeTab === 'register' && (
          <div className="space-y-6 animate-fade-in">
            {/* Shift History Toggle Button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (!currentUser) {
                    setLoginRequiredAction('view-history');
                    setIsLoginModalOpen(true);
                    return;
                  }
                  setShowHistory(!showHistory);
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-300 text-gray-700 font-semibold text-xs rounded-xl hover:bg-gray-50 hover:text-blue-600 transition shadow-xs"
              >
                <History size={16} />
                {showHistory ? 'Hide Shift History' : 'View Shift History'}
              </button>
            </div>

            {/* New Drawer Setup Section */}
            <DrawerControls
              drawerNumber={drawerNumber}
              cashierName={cashierName || currentUser?.fullName || ''}
              organizationName={organizationName}
              onDrawerNumberChange={setDrawerNumber}
              onCashierNameChange={setCashierName}
              onOrganizationNameChange={setOrganizationName}
              onStartShift={handleStartShift}
            />

            {/* Active Drawers Tab */}
            {activeShifts.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                  Active Registered Tills ({activeShifts.length})
                </h2>
                <ActiveDrawers
                  shifts={activeShifts}
                  onSelectShift={handleSelectShift}
                  selectedShiftId={selectedShift?.id || null}
                />
              </div>
            )}

            {/* Active Drawer Working Canvas */}
            {selectedShift && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between bg-blue-50/70 border border-blue-200/80 p-5 rounded-xl mb-6 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
                      <Clock size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 text-base">
                          Drawer #{selectedShift.drawerNumber}
                        </h3>
                        <span className="text-xs bg-blue-100 text-blue-800 font-medium px-2 py-0.5 rounded">
                          Cashier: {selectedShift.cashierName}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Started: {format(new Date(selectedShift.openTime), 'PPpp')}
                      </div>
                      <div className="text-sm font-semibold text-gray-800 mt-0.5">
                        Opening Float: ${selectedShift.openingBalance.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions & Shift Drop */}
                  <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
                    <div className="flex items-center bg-white border border-gray-300 rounded-xl px-3 py-1.5 shadow-xs">
                      <span className="text-xs font-semibold text-gray-600 mr-2">Cash Drop: $</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={shiftDrop || ''}
                        onChange={(e) =>
                          setShiftDrop(parseFloat(e.target.value) || 0)
                        }
                        className="w-20 text-sm font-semibold outline-hidden"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenNewLogModal('Sales')}
                      title="Log shift group lead or note"
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-xl hover:bg-emerald-100 transition shadow-xs"
                    >
                      <FileText size={15} />
                      + Shift Log
                    </button>

                    <button
                      type="button"
                      onClick={() => printReceipt({
                        ...selectedShift,
                        closingBalance: currentTotal,
                        shiftDrop,
                        entries,
                      })}
                      title="Print receipt of current count"
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50 hover:text-blue-600 transition shadow-xs"
                    >
                      <Printer size={15} />
                      Print Receipt
                    </button>

                    <button
                      type="button"
                      onClick={() => generatePDF({
                        ...selectedShift,
                        closingBalance: currentTotal,
                        shiftDrop,
                        entries,
                      })}
                      title="Download current count PDF"
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50 hover:text-blue-600 transition shadow-xs"
                    >
                      <FileText size={15} />
                      PDF Summary
                    </button>

                    <button
                      onClick={handleEndShift}
                      className="px-4 py-2 bg-red-600 text-white font-semibold text-xs rounded-xl hover:bg-red-700 transition shadow-xs"
                    >
                      End Shift & Reconcile
                    </button>
                  </div>
                </div>

                {/* Currency Breakdown Grids */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <CashSection
                    title="Bills"
                    type="bill"
                    entries={entries}
                    denominations={DENOMINATIONS.bill}
                    onUpdate={updateEntry}
                  />
                  <CashSection
                    title="Loose Coins"
                    type="coin"
                    entries={entries}
                    denominations={DENOMINATIONS.coin}
                    onUpdate={updateEntry}
                  />
                  <CashSection
                    title="Bank Rolls"
                    type="roll"
                    entries={entries}
                    denominations={DENOMINATIONS.roll}
                    onUpdate={updateEntry}
                  />
                  <ReceiptsSection entries={entries} onUpdate={updateEntry} />
                </div>

                {/* Summary Bar */}
                <div className="mt-8 p-5 bg-gray-50 border border-gray-200 rounded-xl">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <span className="text-xs uppercase tracking-wider font-bold text-gray-500 block mb-0.5">
                        Live Cash Counted
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-gray-900 font-mono">
                          ${currentTotal.toFixed(2)}
                        </span>
                        <span className="text-xs text-gray-500">
                          (including float + receipts)
                        </span>
                      </div>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-xs uppercase tracking-wider font-bold text-gray-500 block mb-0.5">
                        Variance From Float
                      </span>
                      <span
                        className={`inline-flex items-center text-sm font-bold px-2.5 py-1 rounded-md ${
                          currentDifference === 0
                            ? 'bg-gray-100 text-gray-700'
                            : currentDifference > 0
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {currentDifference >= 0 ? '+' : ''}${currentDifference.toFixed(2)}
                        {currentDifference > 0 && ' (Intake / Over)'}
                        {currentDifference < 0 && ' (Shortage)'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* History Modal / Drawer */}
            {showHistory && (
              <div className="mb-8">
                <ShiftHistory 
                  history={shiftHistory} 
                  onHistoryCleared={() => {
                    p2pSyncManager.broadcastHistoryCleared();
                    loadShiftsData();
                  }} 
                />
              </div>
            )}
          </div>
        )}

        {/* -------------------- TAB 2: SHIFT LOGS & HOSPITALITY LEADS -------------------- */}
        {activeTab === 'logs' && (
          <div className="animate-fade-in">
            {!currentUser && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center justify-between">
                <span className="flex items-center space-x-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Viewing public shift logs. Please sign in to create new sales leads or edit entries.</span>
                </span>
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="px-2.5 py-1 bg-amber-600 text-white rounded-lg font-bold"
                >
                  Sign In
                </button>
              </div>
            )}

            <ShiftLogDashboard
              logs={shiftLogs}
              currentUser={currentUser || {
                id: 'guest',
                username: 'guest',
                passwordHash: '',
                fullName: 'Front Desk Guest',
                role: 'clerk',
                createdAt: new Date().toISOString(),
                isActive: true,
              }}
              onOpenNewModal={handleOpenNewLogModal}
              onEditLog={handleEditLog}
              onDeleteLog={handleDeleteLog}
              onRefresh={loadLogsData}
            />
          </div>
        )}

        {/* -------------------- TAB 3: REMINDERS -------------------- */}
        {activeTab === 'reminders' && (
          <div className="animate-fade-in">
            <RemindersTab
              logs={shiftLogs}
              currentUser={currentUser || {
                id: 'guest',
                username: 'guest',
                passwordHash: '',
                fullName: 'Front Desk Guest',
                role: 'clerk',
                createdAt: new Date().toISOString(),
                isActive: true,
              }}
              onEditLog={handleEditLog}
              onRefresh={loadLogsData}
            />
          </div>
        )}
      </main>

      {/* Staff Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => {
          setIsLoginModalOpen(false);
          setLoginRequiredAction(null);
        }}
        onSuccess={(user) => {
          setCurrentUser(user);
          setCashierName(user.fullName);
          setIsLoginModalOpen(false);
          if (loginRequiredAction === 'admin') {
            setIsUserMgmtModalOpen(true);
          }
          setLoginRequiredAction(null);
        }}
      />

      {/* Shift Log Create / Edit Modal */}
      {currentUser && (
        <ShiftLogModal
          isOpen={isLogModalOpen}
          onClose={() => {
            setIsLogModalOpen(false);
            setEditingLogEntry(null);
          }}
          currentUser={currentUser}
          currentShiftId={selectedShift?.id}
          drawerNumber={selectedShift?.drawerNumber || drawerNumber}
          defaultCategory={defaultLogCat}
          editEntry={editingLogEntry}
          onSaved={() => {
            loadLogsData();
          }}
        />
      )}

      {/* Manager Console Modal */}
      {currentUser && currentUser.role === 'manager' && (
        <UserManagementModal
          isOpen={isUserMgmtModalOpen}
          onClose={() => setIsUserMgmtModalOpen(false)}
          currentUser={currentUser}
        />
      )}

      {/* Peer-to-Peer Network Sync Modal */}
      <NetworkSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSyncTriggered={() => {
          loadShiftsData();
          loadLogsData();
        }}
      />

      {/* Browser Extension Info & Download Modal */}
      <ExtensionModal
        isOpen={isExtensionModalOpen}
        onClose={() => setIsExtensionModalOpen(false)}
        isFloatingBubbleEnabled={isFloatingBubbleEnabled}
        onToggleFloatingBubble={() => {
          setIsFloatingBubbleEnabled(!isFloatingBubbleEnabled);
          if (!isFloatingBubbleEnabled) setIsFloatingBubbleOpen(true);
        }}
      />

      {/* Interactive In-App Floating Extension Bubble */}
      {isFloatingBubbleEnabled && (
        <FloatingExtensionBubble
          currentUser={currentUser}
          onLogSaved={loadLogsData}
          isOpen={isFloatingBubbleOpen}
          onToggle={() => setIsFloatingBubbleOpen(!isFloatingBubbleOpen)}
        />
      )}

      <Footer />
    </div>
  );
}

export default CashDrawer;
