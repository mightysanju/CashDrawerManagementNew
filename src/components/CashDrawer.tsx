import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
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
  Puzzle,
  ChevronUp,
  Sun,
  Moon,
  Key,
  CheckCircle2
} from 'lucide-react';
import { CashEntry, ShiftRecord, ShiftLogEntry, UserAccount, PrimaryCategory } from '../types';
import { ShiftHistory } from './ShiftHistory';
import { DatabaseManager } from '../utils/database';
import { CashSection } from './cash-sections/CashSection';
import { ReceiptsSection } from './cash-sections/ReceiptsSection';
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
import { ChangePasswordModal } from './ChangePasswordModal';
import { OpenShiftModal } from './OpenShiftModal';
import { CloseShiftModal } from './CloseShiftModal';
import { NewHotelSetupModal } from './NewHotelSetupModal';
import { generatePDF, printReceipt } from '../utils/pdfGenerator';
import { p2pSyncManager, SyncState } from '../utils/p2pSyncManager';
import { authManager } from '../utils/authManager';
import { useTheme } from '../utils/themeManager';

const DENOMINATIONS = {
  bill: [100, 50, 20, 10, 5, 1],
  coin: [1, 0.25, 0.10, 0.05, 0.01],
  roll: [10, 5, 2, 1, 0.5],
};

const db = new DatabaseManager();

export function CashDrawer() {
  const { isDark, toggleTheme } = useTheme();

  // Authentication State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(authManager.getCurrentUser());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginRequiredAction, setLoginRequiredAction] = useState<string | null>(null);

  // Shift & Drawer State
  const [organizationName, setOrganizationName] = useState('');
  const [drawerNumber, setDrawerNumber] = useState('');
  const [activeShifts, setActiveShifts] = useState<ShiftRecord[]>([]);
  const [selectedShift, setSelectedShift] = useState<ShiftRecord | null>(null);
  const [shiftHistory, setShiftHistory] = useState<ShiftRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [shiftDrop, setShiftDrop] = useState<number>(0);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  // Auto-popups & Unified View States
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [isBusyRemindPending, setIsBusyRemindPending] = useState(false);
  const [isTallyExpanded, setIsTallyExpanded] = useState(false);
  const [unifiedSubView, setUnifiedSubView] = useState<'dashboard' | 'reminders'>('dashboard');

  // Shift Logs & Reminders State
  const [shiftLogs, setShiftLogs] = useState<ShiftLogEntry[]>([]);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [editingLogEntry, setEditingLogEntry] = useState<ShiftLogEntry | null>(null);
  const [defaultLogCat, setDefaultLogCat] = useState<PrimaryCategory>('Sales');

  // Modals
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isUserMgmtModalOpen, setIsUserMgmtModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [isNewHotelSetupModalOpen, setIsNewHotelSetupModalOpen] = useState(false);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [welcomeToast, setWelcomeToast] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>(p2pSyncManager.getState());

  // Browser Extension & Floating Bubble States
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);
  const [isFloatingBubbleEnabled, setIsFloatingBubbleEnabled] = useState(true);
  const [isFloatingBubbleOpen, setIsFloatingBubbleOpen] = useState(false);

  // Compute next suggested drawer number for multi-terminal operations
  const nextSuggestedDrawerNumber = useMemo(() => {
    if (activeShifts.length === 0) return '1';
    const usedNumbers = activeShifts
      .map((s) => parseInt(s.drawerNumber, 10))
      .filter((n) => !isNaN(n));
    if (usedNumbers.length === 0) return '1';
    const maxNum = Math.max(...usedNumbers);
    return (maxNum + 1).toString();
  }, [activeShifts]);

  // Load shifts and settings from IndexedDB
  const loadShiftsData = useCallback(async () => {
    try {
      const [allShifts, settings] = await Promise.all([
        db.getAllShifts(),
        db.getSettings(),
      ]);

      const lastPurged = parseInt(localStorage.getItem('cdm_last_purged_epoch') || '0', 10);
      const activeEpoch = Math.max(settings?.databaseEpoch || 0, lastPurged);
      const isRestored = settings?.isRestoredArchive;

      // Filter out and asynchronously purge obsolete ghost shifts created before active database epoch
      let cleanShifts = allShifts;
      if (!isRestored && activeEpoch > 0) {
        cleanShifts = allShifts.filter((shift) => {
          const shiftTime = new Date(shift.openTime || shift.closeTime || 0).getTime();
          if (shiftTime > 0 && shiftTime < (activeEpoch - 10000)) {
            db.deleteShift(shift.id).catch(() => {});
            return false;
          }
          return true;
        });
      }

      const active = cleanShifts.filter((shift) => shift.status === 'open');
      const closed = cleanShifts.filter((shift) => shift.status === 'closed');

      setActiveShifts(active);
      setShiftHistory(closed);

      const localUser = authManager.getCurrentUser();
      const localShiftId = localStorage.getItem('cdm_local_active_shift_id');

      setSelectedShift((prevSelected) => {
        // 1. Maintain currently selected shift if still open
        if (prevSelected) {
          const updated = active.find((s) => s.id === prevSelected.id);
          if (updated) {
            setEntries(updated.entries);
            setShiftDrop(updated.shiftDrop || 0);
            return updated;
          }
        }

        // 2. Load shift previously active on this local terminal
        if (localShiftId) {
          const remembered = active.find((s) => s.id === localShiftId);
          if (remembered) {
            setEntries(remembered.entries);
            setShiftDrop(remembered.shiftDrop || 0);
            setDrawerNumber(remembered.drawerNumber);
            return remembered;
          }
        }

        // 3. Match an active shift owned by the logged-in user on this computer
        if (localUser) {
          const myShift = active.find((s) => s.cashierId === localUser.id);
          if (myShift) {
            localStorage.setItem('cdm_local_active_shift_id', myShift.id);
            setEntries(myShift.entries);
            setShiftDrop(myShift.shiftDrop || 0);
            setDrawerNumber(myShift.drawerNumber);
            return myShift;
          }
        }

        // 4. If no user is logged in and exactly 1 active shift exists, display it for monitoring
        if (!localUser && active.length === 1) {
          setEntries(active[0].entries);
          setShiftDrop(active[0].shiftDrop || 0);
          setDrawerNumber(active[0].drawerNumber);
          return active[0];
        }

        // Keep unselected so this terminal can open its own drawer independently without session clobbering
        return null;
      });
    } catch (error) {
      console.error('Error loading shifts data:', error);
    }
  }, []);

  const loadLogsData = useCallback(async () => {
    try {
      const [logs, settings] = await Promise.all([
        db.getAllShiftLogs(),
        db.getSettings(),
      ]);

      const lastPurged = parseInt(localStorage.getItem('cdm_last_purged_epoch') || '0', 10);
      const isRestored = settings?.isRestoredArchive;

      // Filter out any ghost logs from an old purged database
      let cleanLogs = logs;
      if (!isRestored && lastPurged > 0) {
        cleanLogs = logs.filter((l) => {
          const logTime = new Date(l.createdAt || 0).getTime();
          return logTime === 0 || logTime >= (lastPurged - 10000);
        });
      }

      setShiftLogs(cleanLogs);
    } catch (error) {
      console.error('Error loading shift logs:', error);
    }
  }, []);

  const handleSelectShift = useCallback((shift: ShiftRecord) => {
    setSelectedShift(shift);
    setEntries(shift.entries);
    setShiftDrop(shift.shiftDrop || 0);
    setOrganizationName(shift.organizationName || '');
    setDrawerNumber(shift.drawerNumber);
    localStorage.setItem('cdm_local_active_shift_id', shift.id);
  }, []);

  const loadSettingsData = useCallback(async () => {
    try {
      const s = await db.getSettings();
      setAppSettings(s);
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  }, []);

  const checkPromptDrawerOpen = useCallback(async (user: UserAccount) => {
    try {
      const [allShifts, currentSettings] = await Promise.all([
        db.getAllShifts(),
        db.getSettings(),
      ]);
      setAppSettings(currentSettings);
      const openShifts = allShifts.filter((s) => s.status === 'open');
      const maxAllowed = currentSettings.maxOpenDrawers || 1;

      // 1. If this user already has an active open drawer, select it and do not prompt
      const myActive = openShifts.find((s) => s.cashierId === user.id);
      if (myActive) {
        handleSelectShift(myActive);
        return;
      }

      // 2. If the count of open drawers has already reached maxAllowed,
      // DO NOT ask other person logging in to open one!
      // Select the first active drawer so they can work with it immediately.
      if (openShifts.length >= maxAllowed) {
        if (openShifts.length > 0) {
          handleSelectShift(openShifts[0]);
        }
        return;
      }

      // 3. Otherwise (fewer than maxAllowed open and user has no drawer), prompt to open
      setIsOpenShiftModalOpen(true);
    } catch (err) {
      console.error('Failed to check active drawers count:', err);
    }
  }, [handleSelectShift]);

  const handleUserRequestOpenShift = async () => {
    if (!currentUser) {
      setLoginRequiredAction('open-drawer');
      setIsLoginModalOpen(true);
      return;
    }
    const [allShifts, currentSettings] = await Promise.all([
      db.getAllShifts(),
      db.getSettings(),
    ]);
    setAppSettings(currentSettings);
    const openShifts = allShifts.filter((s) => s.status === 'open');
    const maxAllowed = currentSettings.maxOpenDrawers || 1;
    if (openShifts.length >= maxAllowed) {
      alert(
        `Maximum open drawer limit (${maxAllowed}) reached.\n\nThere ${openShifts.length === 1 ? 'is already 1 drawer' : `are already ${openShifts.length} drawers`} active. Please close an active drawer before opening a new one, or have a manager increase the "Max Simultaneous Open Drawers" in Manager Console Settings.`
      );
      return;
    }
    setIsOpenShiftModalOpen(true);
  };

  useEffect(() => {
    loadShiftsData();
    loadLogsData();
    loadSettingsData();

    // When app is loaded and cannot find a local database, launch Setup modal with 2 options:
    // Option 1: Sync from local network (lists available databases)
    // Option 2: Create account if no sync database is available
    db.hasUsers().then(async (hasUsers) => {
      const org = await db.getOrganization();
      const savedStore = localStorage.getItem('cdm_store_name');
      const hasValidStore = savedStore && savedStore.trim().toLowerCase() !== 'main store';

      if (!hasUsers || (!org && !hasValidStore)) {
        setIsNewHotelSetupModalOpen(true);
        setIsLoginModalOpen(false);
      }
    });

    p2pSyncManager.scanNetworkAndAutoSync(() => {
      setIsNewHotelSetupModalOpen(true);
      setIsLoginModalOpen(false);
    });

    const unsubAuth = authManager.subscribe((user) => {
      setCurrentUser(user);
      if (user) {
        const hasSnoozed = sessionStorage.getItem(`fdp_snooze_float_${user.id}`) === 'true';
        if (hasSnoozed) {
          setIsBusyRemindPending(true);
        } else {
          checkPromptDrawerOpen(user);
        }
      }
    });

    // Listen for shift logs captured by the browser extension across all domains
    const handleExtensionLog = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const entry = customEvent.detail;
      const lastPurged = parseInt(localStorage.getItem('cdm_last_purged_epoch') || '0', 10);
      if (entry && entry.id) {
        const logTime = new Date(entry.createdAt || 0).getTime();
        if (lastPurged > 0 && logTime > 0 && logTime <= lastPurged) {
          return;
        }
        await db.saveShiftLog(entry);
        p2pSyncManager.broadcastShiftLog(entry);
        await loadLogsData();
      }
    };

    const handleExtensionLogsSync = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const logs = customEvent.detail;
      if (Array.isArray(logs) && logs.length > 0) {
        const lastPurged = parseInt(localStorage.getItem('cdm_last_purged_epoch') || '0', 10);
        let added = false;
        for (const l of logs) {
          if (l && l.id) {
            const logTime = new Date(l.createdAt || 0).getTime();
            if (lastPurged > 0 && logTime > 0 && logTime <= lastPurged) {
              continue;
            }
            await db.saveShiftLog(l);
            added = true;
          }
        }
        if (added) {
          await loadLogsData();
        }
      }
    };

    // Cross-World postMessage listener (Guaranteed bridge between Chrome extension & Netlify/localhost)
    const handleWindowMessage = async (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;

      const lastPurged = parseInt(localStorage.getItem('cdm_last_purged_epoch') || '0', 10);

      if (event.data.type === 'FDP_EXTENSION_LOG_RECEIVED' && event.data.log) {
        const entry = event.data.log;
        if (entry && entry.id) {
          const logTime = new Date(entry.createdAt || 0).getTime();
          if (lastPurged > 0 && logTime > 0 && logTime <= lastPurged) {
            return;
          }
          await db.saveShiftLog(entry);
          p2pSyncManager.broadcastShiftLog(entry);
          await loadLogsData();
        }
      } else if (event.data.type === 'FDP_EXTENSION_LOGS_SYNC' && Array.isArray(event.data.logs)) {
        let added = false;
        for (const l of event.data.logs) {
          if (l && l.id) {
            const logTime = new Date(l.createdAt || 0).getTime();
            if (lastPurged > 0 && logTime > 0 && logTime <= lastPurged) {
              continue;
            }
            await db.saveShiftLog(l);
            added = true;
          }
        }
        if (added) {
          await loadLogsData();
        }
      }
    };

    window.addEventListener('message', handleWindowMessage);
    window.addEventListener('FDP_EXTENSION_LOG_RECEIVED', handleExtensionLog);
    window.addEventListener('FDP_EXTENSION_LOGS_SYNC', handleExtensionLogsSync);
    document.addEventListener('FDP_EXTENSION_LOG_RECEIVED', handleExtensionLog);
    document.addEventListener('FDP_EXTENSION_LOGS_SYNC', handleExtensionLogsSync);

    // Initial request for any pending extension logs
    window.postMessage({ type: 'FDP_REQUEST_PENDING_LOGS' }, '*');

    // Periodic pull every 3 seconds to guarantee background sync from other tabs
    const pollInterval = setInterval(() => {
      window.postMessage({ type: 'FDP_REQUEST_PENDING_LOGS' }, '*');
    }, 3000);

    const unsubState = p2pSyncManager.subscribeState(setSyncState);
    const unsubData = p2pSyncManager.subscribeData(async (action, data) => {
      if (action === 'DATABASE_PURGED') {
        setSelectedShift(null);
        setActiveShifts([]);
        setShiftHistory([]);
        setShiftLogs([]);
        setEntries([]);
        setShiftDrop(0);
        setCurrentUser(null);
        authManager.logout();
        setIsLoginModalOpen(false);
        setIsNewHotelSetupModalOpen(true);
        setWelcomeToast('Register database was archived and reset by a manager. Ready for new hotel setup.');
        return;
      }

      if (action === 'DATABASE_INITIALIZED') {
        setSelectedShift(null);
        setActiveShifts([]);
        setShiftHistory([]);
        setShiftLogs([]);
        setEntries([]);
        setShiftDrop(0);
        setCurrentUser(null);
        authManager.logout();
        setIsNewHotelSetupModalOpen(false);
        setIsLoginModalOpen(true);
        await loadShiftsData();
        await loadLogsData();
        await loadSettingsData();
        const hotelName = (data as { hotelName?: string })?.hotelName || 'Hotel';
        setWelcomeToast(`Connected and synced to new clean hotel database: ${hotelName}`);
        setTimeout(() => setWelcomeToast(null), 4000);
        return;
      }

      if (action === 'NETWORK_SWITCH_FOLLOWED') {
        const newDb = (data as string) || 'Active Hotel';
        setWelcomeToast(`Followed network sync: Switched to ${newDb}`);
        setTimeout(() => setWelcomeToast(null), 4000);
        await loadShiftsData();
        await loadLogsData();
        await loadSettingsData();
        return;
      }

      if (action === 'NO_DATABASE_AVAILABLE') {
        setSelectedShift(null);
        setActiveShifts([]);
        setShiftHistory([]);
        setShiftLogs([]);
        setEntries([]);
        setShiftDrop(0);
        setCurrentUser(null);
        authManager.logout();
        setIsLoginModalOpen(false);
        setIsNewHotelSetupModalOpen(true);
        return;
      }

      loadShiftsData();
      loadLogsData();
      loadSettingsData();
    });

    return () => {
      unsubAuth();
      unsubState();
      unsubData();
      clearInterval(pollInterval);
      window.removeEventListener('message', handleWindowMessage);
      window.removeEventListener('FDP_EXTENSION_LOG_RECEIVED', handleExtensionLog);
      window.removeEventListener('FDP_EXTENSION_LOGS_SYNC', handleExtensionLogsSync);
      document.removeEventListener('FDP_EXTENSION_LOG_RECEIVED', handleExtensionLog);
      document.removeEventListener('FDP_EXTENSION_LOGS_SYNC', handleExtensionLogsSync);
    };
  }, [loadShiftsData, loadLogsData, loadSettingsData, checkPromptDrawerOpen]);

  // Initial check for open drawer on mount
  useEffect(() => {
    if (currentUser && !selectedShift) {
      const hasSnoozed = sessionStorage.getItem(`fdp_snooze_float_${currentUser.id}`) === 'true';
      if (hasSnoozed) {
        setIsBusyRemindPending(true);
      } else {
        checkPromptDrawerOpen(currentUser);
      }
    }
  }, [currentUser, selectedShift, checkPromptDrawerOpen]);

  const pendingRemindersCount = shiftLogs.filter(
    (l) => l.hasReminder && !l.isReminderCompleted
  ).length;

  const handleModalStartShift = async (
    drawerNum: string,
    openingFloat: number,
    openingEntries: CashEntry[]
  ) => {
    if (!currentUser) {
      setIsLoginModalOpen(true);
      return;
    }

    try {
      const newShift: ShiftRecord = {
        id: Date.now().toString(),
        organizationName: organizationName || 'Front Desk',
        drawerNumber: drawerNum,
        cashierName: currentUser.fullName,
        cashierId: currentUser.id,
        openTime: new Date().toISOString(),
        openingBalance: openingFloat,
        entries: openingEntries,
        status: 'open',
      };

      await db.saveShift(newShift);
      p2pSyncManager.broadcastShift(newShift);

      // Auto-log a shift note in Recent Activity
      const startLog: ShiftLogEntry = {
        id: `log_open_${Date.now()}`,
        category: 'Miscellaneous',
        clerkId: currentUser.id,
        clerkName: currentUser.fullName,
        topic: `Shift Started: Drawer #${drawerNum} Opened`,
        clerkNotes: `Drawer #${drawerNum} opened with starting till float of $${openingFloat.toFixed(2)}.`,
        hasReminder: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        responses: [],
      };
      await db.saveShiftLog(startLog);
      p2pSyncManager.broadcastShiftLog(startLog);

      await loadShiftsData();
      await loadLogsData();
      handleSelectShift(newShift);

      setIsBusyRemindPending(false);
      sessionStorage.removeItem(`fdp_snooze_float_${currentUser.id}`);
      setIsOpenShiftModalOpen(false);
    } catch (error) {
      console.error('Error starting shift:', error);
      alert('Failed to start shift. Please try again.');
    }
  };

  const handleRemindLater = () => {
    if (currentUser) {
      sessionStorage.setItem(`fdp_snooze_float_${currentUser.id}`, 'true');
    }
    setIsBusyRemindPending(true);
    setIsOpenShiftModalOpen(false);
  };

  const handleConfirmCloseShift = async (
    finalDrop: number,
    closingNotes: string
  ) => {
    if (!selectedShift) return;

    const currentBalance = calculateTotal();
    const totalDrop = (selectedShift.shiftDrop || 0) + (finalDrop || 0);

    const closedShift: ShiftRecord = {
      ...selectedShift,
      closeTime: new Date().toISOString(),
      closingBalance: currentBalance,
      shiftDrop: totalDrop,
      entries: [...entries],
      status: 'closed',
    };

    await db.saveShift(closedShift);
    p2pSyncManager.broadcastShift(closedShift);

    // Auto-create a shift log handover note in Recent Activity
    const handoverLog: ShiftLogEntry = {
      id: `log_close_${Date.now()}`,
      category: 'Miscellaneous',
      clerkId: currentUser?.id || 'usr_staff',
      clerkName: currentUser?.fullName || 'Front Desk Staff',
      topic: `Shift Handover: Drawer #${selectedShift.drawerNumber} Closed`,
      clerkNotes: `Drawer #${selectedShift.drawerNumber} closed. Counted Till: $${currentBalance.toFixed(2)}, Float: $${selectedShift.openingBalance.toFixed(2)}, Safe Drop: $${totalDrop.toFixed(2)}.${closingNotes ? ` Notes: ${closingNotes}` : ''}`,
      hasReminder: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      responses: [],
    };
    await db.saveShiftLog(handoverLog);
    p2pSyncManager.broadcastShiftLog(handoverLog);

    // Download PDF audit report
    setTimeout(() => {
      generatePDF(closedShift);
    }, 100);

    localStorage.removeItem('cdm_local_active_shift_id');
    setSelectedShift(null);
    setEntries([]);
    setShiftDrop(0);
    setIsCloseShiftModalOpen(false);
    await loadShiftsData();
    await loadLogsData();

    // Seamless logout after shift close
    authManager.logout();
    setIsLoginModalOpen(true);
  };

  const handleRequestSignOut = () => {
    if (selectedShift) {
      setIsSignOutModalOpen(true);
    } else {
      localStorage.removeItem('cdm_local_active_shift_id');
      authManager.logout();
      setSelectedShift(null);
      setEntries([]);
      setShiftDrop(0);
      setIsLoginModalOpen(true);
    }
  };

  const handleSignOutKeepDrawer = () => {
    localStorage.removeItem('cdm_local_active_shift_id');
    authManager.logout();
    setSelectedShift(null);
    setEntries([]);
    setShiftDrop(0);
    setIsSignOutModalOpen(false);
    setIsLoginModalOpen(true);
  };

  const handleSignOutCloseShift = () => {
    setIsSignOutModalOpen(false);
    setIsCloseShiftModalOpen(true);
  };

  const handleSetupComplete = async (manager?: UserAccount) => {
    setIsNewHotelSetupModalOpen(false);
    await loadShiftsData();
    await loadLogsData();
    await loadSettingsData();
    if (manager) {
      setWelcomeToast(`Hotel network initialized for ${manager.fullName}`);
    } else {
      setWelcomeToast('Connected and synchronized with network register.');
      setIsLoginModalOpen(true);
    }
    setTimeout(() => setWelcomeToast(null), 4000);
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
        shiftDrop: shiftDrop !== undefined ? shiftDrop : selectedShift.shiftDrop,
      };
      db.saveShift(updatedShift);
      p2pSyncManager.broadcastShift(updatedShift);
    }
  };

  const handleUpdateShiftDrop = async (newDrop: number) => {
    setShiftDrop(newDrop);
    if (selectedShift) {
      const updatedShift: ShiftRecord = {
        ...selectedShift,
        shiftDrop: newDrop,
      };
      setSelectedShift(updatedShift);
      try {
        await db.saveShift(updatedShift);
        p2pSyncManager.broadcastShift(updatedShift);
      } catch (err) {
        console.error('Error saving shift drop:', err);
      }
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
    setEditingLogEntry(entry);
    setIsLogModalOpen(true);
  };

  const handleDeleteLog = async (id: string) => {
    await db.deleteShiftLog(id);
    p2pSyncManager.broadcastShiftLogDelete(id);
    loadLogsData();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-gray-100 flex flex-col justify-between pt-16 transition-colors duration-200">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-grow">
        {/* -------------------- MAIN APP HEADER & USER PROFILE BAR -------------------- */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-5">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
                FrontDesk Operations Platform
              </h1>
              {selectedShift && (
                <span className="hidden sm:inline-flex items-center space-x-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-medium px-2 py-0.5 rounded-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Drawer #{selectedShift.drawerNumber} Active</span>
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Unified cash register, group sales leads, guest complaints, and live shift handoffs on one page.
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
                  onClick={() => setIsChangePasswordModalOpen(true)}
                  title="Change My Password"
                  className="ml-1 p-1 text-gray-400 hover:text-blue-600 rounded-lg transition cursor-pointer"
                >
                  <Key className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleRequestSignOut}
                  title="Sign Out / Close Shift"
                  className="p-1 text-gray-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
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
              title={`Network Sync: ${syncState.storeName} (${syncState.role === 'hub' ? 'Primary Hub' : 'Connected Register'})`}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors shadow-xs ${
                syncState.status === 'connected'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : syncState.status === 'scanning'
                    ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
              }`}
            >
              <Wifi size={14} className={syncState.status === 'connected' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'} />
              {syncState.status === 'connected' ? (
                syncState.role === 'hub' ? (
                  <span className="truncate max-w-[210px]">
                    Sync: <strong>{syncState.storeName}</strong> {syncState.connectedCount > 0 ? `(${syncState.connectedCount + 1} online)` : '(Hub)'}
                  </span>
                ) : (
                  <span className="truncate max-w-[210px]">
                    Sync: <strong>{syncState.storeName}</strong> {syncState.connectedCount > 0 ? `(${syncState.connectedCount + 1} online)` : '(In Sync)'}
                  </span>
                )
              ) : syncState.status === 'scanning' ? (
                <span className="truncate max-w-[210px]">
                  Syncing {syncState.storeName}...
                </span>
              ) : (
                <span className="truncate max-w-[210px]">
                  Sync: {syncState.storeName} (Offline)
                </span>
              )}
            </button>

            {/* Browser Extension Button */}
            <button
              type="button"
              onClick={() => setIsExtensionModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl text-xs font-semibold transition shadow-xs"
              title="Get FrontDesk Pro Browser Extension for floating shift logs"
            >
              <Puzzle size={15} className="text-blue-600 dark:text-blue-400" />
              <span>Extension</span>
            </button>

            {/* Dark Mode Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl text-xs font-semibold transition shadow-xs cursor-pointer"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? (
                <Sun size={15} className="text-amber-400" />
              ) : (
                <Moon size={15} className="text-slate-600 dark:text-slate-300" />
              )}
              <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </div>

        {/* -------------------- 1. PENDING FLOAT REMINDER BANNER -------------------- */}
        {isBusyRemindPending && !selectedShift && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3.5 mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 rounded-lg">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                  Opening Till Float Pending
                </h4>
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  Clerk on duty: {currentUser?.fullName || 'Staff'}. Verify your starting till float when available to maintain accurate shift records.
                </p>
              </div>
            </div>
            <button
              onClick={handleUserRequestOpenShift}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs rounded-lg transition-colors flex-shrink-0 cursor-pointer"
            >
              Count Opening Float
            </button>
          </div>
        )}

        {/* Multi-Drawer & Multi-Terminal Switcher Strip */}
        {activeShifts.length > 0 && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 mb-4 flex flex-wrap items-center justify-between gap-2 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mr-1">
                <Coins className="w-3.5 h-3.5 text-slate-400" />
                <span>Active Registers ({activeShifts.length}):</span>
              </span>
              {activeShifts.map((shift) => {
                const isSelected = selectedShift?.id === shift.id;
                const isMyShift = currentUser && shift.cashierId === currentUser.id;
                return (
                  <button
                    key={shift.id}
                    type="button"
                    onClick={() => handleSelectShift(shift)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-emerald-500'}`} />
                    <span>Drawer #{shift.drawerNumber}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>
                      ({shift.cashierName}{isMyShift ? ' • You' : ''})
                    </span>
                  </button>
                );
              })}
            </div>
            {currentUser && (
              <button
                type="button"
                onClick={handleUserRequestOpenShift}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-semibold transition cursor-pointer"
                title={
                  activeShifts.length >= (appSettings?.maxOpenDrawers || 1)
                    ? `Maximum open drawers limit (${appSettings?.maxOpenDrawers || 1}) reached`
                    : "Open another register drawer on this machine"
                }
              >
                <span>+ Open Drawer #{nextSuggestedDrawerNumber}</span>
              </button>
            )}
          </div>
        )}

        {/* -------------------- 2. ACTIVE TILL & CASH REGISTER COMMAND BAR -------------------- */}
        {selectedShift ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-5 mb-6 shadow-xs transition-colors">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              {/* Drawer Info & Metrics */}
              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-900 text-white rounded-lg">
                  <Coins size={18} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                      Active Till: Drawer #{selectedShift.drawerNumber}
                    </h3>
                    <span className="text-[11px] bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium px-2 py-0.5 rounded-md inline-flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>Active Shift</span>
                    </span>
                    <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-normal px-2 py-0.5 rounded-md">
                      Cashier: {selectedShift.cashierName}
                    </span>
                  </div>

                  {/* Financial Metrics Strip */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400 mt-1.5">
                    <span>Opening Float: <strong className="text-gray-900 dark:text-white font-mono tabular-nums font-semibold">${selectedShift.openingBalance.toFixed(2)}</strong></span>
                    <span>•</span>
                    <span>Counted Cash: <strong className="text-blue-700 dark:text-blue-400 font-mono tabular-nums font-semibold">${currentTotal.toFixed(2)}</strong></span>
                    <span>•</span>
                    <span>Safe Drops: <strong className="text-gray-900 dark:text-white font-mono tabular-nums font-semibold">${(shiftDrop || 0).toFixed(2)}</strong></span>
                    <span>•</span>
                    <span>Variance: <strong className={`font-mono tabular-nums font-semibold ${currentDifference === 0 ? 'text-gray-700 dark:text-gray-300' : currentDifference > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {currentDifference >= 0 ? '+' : ''}${currentDifference.toFixed(2)}
                    </strong></span>
                  </div>
                </div>
              </div>

              {/* Till Quick Actions */}
              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
                {/* Cash Drop input */}
                <div className="flex items-center bg-gray-50 dark:bg-gray-750 border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-xs">
                  <span className="text-gray-500 dark:text-gray-400 font-medium mr-1.5">Drop: $</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={shiftDrop || ''}
                    onChange={(e) => handleUpdateShiftDrop(parseFloat(e.target.value) || 0)}
                    className="w-16 bg-transparent text-xs font-bold outline-none text-gray-900 dark:text-white"
                    title="Record mid-shift cash skim to safe"
                  />
                </div>

                {/* Tally Denominations Toggle */}
                <button
                  type="button"
                  onClick={() => setIsTallyExpanded(!isTallyExpanded)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition shadow-xs ${
                    isTallyExpanded
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-650'
                  }`}
                >
                  <Coins size={14} />
                  <span>{isTallyExpanded ? 'Hide Till Counter ▲' : 'Count Till Cash ▼'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => printReceipt({
                    ...selectedShift,
                    closingBalance: currentTotal,
                    shiftDrop,
                    entries,
                  })}
                  title="Print current till receipt"
                  className="p-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-650 transition"
                >
                  <Printer size={15} />
                </button>

                <button
                  type="button"
                  onClick={() => generatePDF({
                    ...selectedShift,
                    closingBalance: currentTotal,
                    shiftDrop,
                    entries,
                  })}
                  title="Download audit PDF report"
                  className="p-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-650 transition"
                >
                  <FileText size={15} />
                </button>

                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  title="Review previous shift records"
                  className={`p-1.5 border rounded-lg transition ${
                    showHistory
                      ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-650'
                  }`}
                >
                  <History size={15} />
                </button>

                {/* Close Shift Button */}
                <button
                  type="button"
                  onClick={() => setIsCloseShiftModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-lg text-xs font-bold transition shadow-xs"
                >
                  <LogOut size={14} />
                  <span>Close Shift</span>
                </button>
              </div>
            </div>

            {/* Collapsible Inline Denomination Counter */}
            {isTallyExpanded && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Active Till Denomination Breakdown
                  </h4>
                  <button
                    onClick={() => setIsTallyExpanded(false)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1"
                  >
                    <span>Collapse Till Counter</span>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <CashSection
                    type="bill"
                    title="Bills"
                    denominations={DENOMINATIONS.bill}
                    entries={entries}
                    onUpdateEntry={updateEntry}
                  />
                  <CashSection
                    type="coin"
                    title="Coins"
                    denominations={DENOMINATIONS.coin}
                    entries={entries}
                    onUpdateEntry={updateEntry}
                  />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <CashSection
                    type="roll"
                    title="Coin Rolls"
                    denominations={DENOMINATIONS.roll}
                    entries={entries}
                    onUpdateEntry={updateEntry}
                  />
                  <ReceiptsSection
                    entries={entries}
                    onUpdateEntry={updateEntry}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          /* No Shift Active — Till Starter Bar */
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-5 mb-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-slate-300 rounded-xl">
                <Coins size={22} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                  Cash Register: No Active Till Open
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {currentUser
                    ? `Welcome ${currentUser.fullName}. Open drawer to verify opening float and balance tills.`
                    : 'Sign in to start your shift drawer and access live registers.'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {currentUser ? (
                <button
                  onClick={handleUserRequestOpenShift}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center space-x-1.5"
                >
                  <Coins size={15} />
                  <span>Open Drawer & Set Float</span>
                </button>
              ) : (
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center space-x-1.5"
                >
                  <LogIn size={15} />
                  <span>Staff Sign In</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 transition"
              >
                <History size={15} className="inline mr-1" />
                <span>Archives</span>
              </button>
            </div>
          </div>
        )}

        {/* Shift History Section (Toggled) */}
        {showHistory && (
          <div className="mb-6 animate-in fade-in duration-150">
            <ShiftHistory 
              history={shiftHistory} 
              onHistoryCleared={() => {
                p2pSyncManager.broadcastHistoryCleared();
                loadShiftsData();
              }} 
            />
          </div>
        )}

        {/* -------------------- 3. UNIFIED SHIFT OPERATIONS HUB (ON THE SAME PAGE) -------------------- */}
        <div className="space-y-4">
          {/* Subview Navigation Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-100 p-1 rounded-xl border border-gray-200">
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setUnifiedSubView('dashboard')}
                className={`py-1.5 px-3 rounded-lg font-bold text-xs transition ${
                  unifiedSubView === 'dashboard'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5 inline mr-1 text-blue-600" />
                <span>Shift Operations & Logs ({shiftLogs.length})</span>
              </button>

              <button
                onClick={() => setUnifiedSubView('reminders')}
                className={`py-1.5 px-3 rounded-lg font-bold text-xs transition relative ${
                  unifiedSubView === 'reminders'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Bell className="w-3.5 h-3.5 inline mr-1 text-amber-500" />
                <span>Reminders</span>
                {pendingRemindersCount > 0 && (
                  <span className="ml-1 text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-600 text-white">
                    {pendingRemindersCount}
                  </span>
                )}
              </button>
            </div>

            {currentUser?.role === 'manager' && (
              <button
                onClick={() => setIsUserMgmtModalOpen(true)}
                className="py-1.5 px-3 rounded-lg font-semibold text-xs text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 shadow-xs"
              >
                <ShieldCheck className="w-3.5 h-3.5 inline mr-1 text-blue-600" />
                <span>Manager Console</span>
              </button>
            )}
          </div>

          {/* Unified Content Display */}
          {unifiedSubView === 'dashboard' ? (
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
          ) : (
            <div className="animate-in fade-in">
              <div className="mb-4 flex items-center justify-between">
                <button
                  onClick={() => setUnifiedSubView('dashboard')}
                  className="text-xs text-blue-600 font-semibold hover:underline"
                >
                  ← Back to Shift Operations & Logs
                </button>
              </div>
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
        </div>
      </main>

      {/* Staff Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => {
          setIsLoginModalOpen(false);
          setLoginRequiredAction(null);
        }}
        requiredAction={loginRequiredAction}
        onLoginSuccess={() => {
          loadShiftsData();
          loadLogsData();
        }}
      />

      {/* Shift Log Create/Edit Modal */}
      {isLogModalOpen && (
        <ShiftLogModal
          isOpen={isLogModalOpen}
          onClose={() => {
            setIsLogModalOpen(false);
            setEditingLogEntry(null);
          }}
          currentUser={currentUser!}
          currentShiftId={selectedShift?.id}
          drawerNumber={selectedShift?.drawerNumber || drawerNumber}
          defaultCategory={defaultLogCat}
          editEntry={editingLogEntry}
          onSaved={() => {
            loadLogsData();
          }}
        />
      )}

      {/* Auto-Prompt: Open Shift Drawer Modal */}
      <OpenShiftModal
        isOpen={isOpenShiftModalOpen}
        onClose={() => setIsOpenShiftModalOpen(false)}
        onStartShift={handleModalStartShift}
        onRemindLater={handleRemindLater}
        defaultDrawerNumber={selectedShift?.drawerNumber || nextSuggestedDrawerNumber}
        cashierName={currentUser?.fullName || 'Front Desk Staff'}
      />

      {/* Auto-Prompt: Close Shift Drawer Modal */}
      <CloseShiftModal
        isOpen={isCloseShiftModalOpen}
        onClose={() => setIsCloseShiftModalOpen(false)}
        shift={selectedShift}
        currentBalance={currentTotal}
        onConfirmClose={handleConfirmCloseShift}
      />

      {/* Individual User Change Password Modal */}
      {currentUser && (
        <ChangePasswordModal
          isOpen={isChangePasswordModalOpen}
          onClose={() => setIsChangePasswordModalOpen(false)}
          currentUser={currentUser}
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
        onRequestCreateNewHotel={() => {
          setIsSyncModalOpen(false);
          setIsNewHotelSetupModalOpen(true);
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
          onRequireLogin={() => setIsLoginModalOpen(true)}
        />
      )}

      {/* Seamless Sign-Out Prompt Modal */}
      {isSignOutModalOpen && selectedShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 dark:border-gray-700 p-6 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Staff Sign Out
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Drawer #{selectedShift.drawerNumber} is currently open
                </p>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3.5 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              You are currently signed in with an active drawer (<strong>${currentTotal.toFixed(2)}</strong> counted cash). Would you like to close and balance this drawer now, or keep it open for your break / relief clerk?
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleSignOutCloseShift}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center space-x-1.5"
              >
                <span>Close Shift & Balance Drawer</span>
                <span>&rarr;</span>
              </button>

              <button
                type="button"
                onClick={handleSignOutKeepDrawer}
                className="w-full py-2.5 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-650 text-gray-800 dark:text-gray-200 font-semibold text-xs rounded-xl transition"
              >
                Sign Out Only (Keep Drawer Open)
              </button>

              <button
                type="button"
                onClick={() => setIsSignOutModalOpen(false)}
                className="w-full py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Hotel Network Setup Modal (When no database exists) */}
      <NewHotelSetupModal
        isOpen={isNewHotelSetupModalOpen}
        onSetupComplete={handleSetupComplete}
      />

      {/* Welcome Toast Notification */}
      {welcomeToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-slate-700 text-slate-100 px-4 py-2.5 rounded-lg shadow-md flex items-center space-x-2 text-xs font-medium animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{welcomeToast}</span>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default CashDrawer;
