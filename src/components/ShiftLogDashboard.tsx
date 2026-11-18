import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  AlertTriangle,
  Tag,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Phone,
  User,
  Bell,
  Edit3,
  Trash2,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  List,
  Heart,
  Trophy,
  Briefcase,
  Users,
  Send,
  ExternalLink,
  Check,
  Activity,
  FileText,
} from 'lucide-react';
import {
  ShiftLogEntry,
  SalesLeadStatus,
  ComplaintStatus,
  UserAccount,
  PrimaryCategory,
  LogCategoryConfig,
  ActivityLogEvent,
  ShiftLogStatusChange,
} from '../types';
import { DatabaseManager } from '../utils/database';
import { p2pSyncManager } from '../utils/p2pSyncManager';
import { formatFullTimestamp } from '../utils/dateUtils';
import { getCategoryIconComponent } from '../utils/categoryIcons';
import { SalesKanban } from './SalesKanban';

interface ShiftLogDashboardProps {
  logs: ShiftLogEntry[];
  currentUser: UserAccount;
  onOpenNewModal: (category?: PrimaryCategory) => void;
  onEditLog: (entry: ShiftLogEntry) => void;
  onDeleteLog: (id: string) => void;
  onRefresh: () => void;
}

const db = new DatabaseManager();

type ActiveView = 'overview' | 'sales-kanban' | 'complaints' | 'misc' | string;

export const ShiftLogDashboard: React.FC<ShiftLogDashboardProps> = ({
  logs,
  currentUser,
  onOpenNewModal,
  onEditLog,
  onDeleteLog,
  onRefresh,
}) => {
  const [activeView, setActiveView] = useState<ActiveView>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>('All');
  const [categories, setCategories] = useState<LogCategoryConfig[]>([]);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
  const [activityReplyText, setActivityReplyText] = useState<{ [id: string]: string }>({});

  // Inline Card Reminder State
  const [reminderTargetLogId, setReminderTargetLogId] = useState<string | null>(null);
  const [reminderDateInput, setReminderDateInput] = useState<string>('');
  const [reminderNoteInput, setReminderNoteInput] = useState<string>('');

  // Unified Recent Activity Feed Filter
  type ActivityFeedFilterType = 'All' | 'Replies' | 'Status' | 'Reminders' | 'Created' | 'Deleted';
  const [activityFeedFilter, setActivityFeedFilter] = useState<ActivityFeedFilterType>('All');
  const [persistedEvents, setPersistedEvents] = useState<ActivityLogEvent[]>([]);

  const loadPersistedActivityEvents = React.useCallback(async () => {
    try {
      const events = await db.getActivityEvents();
      setPersistedEvents(events);
    } catch (e) {
      console.error('Error loading persisted activity events:', e);
    }
  }, [db]);

  useEffect(() => {
    loadPersistedActivityEvents();
  }, [loadPersistedActivityEvents, logs]);

  // Load Categories for dynamic subcategory filtering & custom category dashboard boxes
  useEffect(() => {
    db.getCategories().then((cats) => {
      if (cats && cats.length > 0) {
        setCategories(cats);
      }
    });
  }, [logs]);

  const complaintSubcategories = useMemo(() => {
    return categories.find((c) => c.name.toLowerCase() === 'complaint')?.subcategories || [
      'Room Maintenance',
      'Noise / Disturbance',
      'Billing & Folio',
      'Housekeeping / Cleanliness',
      'Staff / Service',
      'Other',
    ];
  }, [categories]);

  const miscSubcategories = useMemo(() => {
    return categories.find((c) => c.name.toLowerCase() === 'miscellaneous')?.subcategories || [
      'Shift Handover',
      'Package Delivery',
      'Lost & Found',
      'Maintenance Request',
      'Manager Note',
    ];
  }, [categories]);

  const salesSubcategories = useMemo(() => {
    return categories.find((c) => c.name.toLowerCase() === 'sales')?.subcategories || [
      'Group',
      'Wedding',
      'Sports team',
      'Company',
      'Bus Tour',
      'Family Reunion',
    ];
  }, [categories]);

  const customCategories = useMemo(() => {
    return categories.filter(
      (c) => c.name !== 'Sales' && c.name !== 'Complaint' && c.name !== 'Miscellaneous'
    );
  }, [categories]);

  const activeCustomCategory = useMemo(() => {
    return customCategories.find((c) => c.name === activeView);
  }, [customCategories, activeView]);

  /* ----- Metrics ----- */
  const salesMetrics = useMemo(() => {
    const sl = logs.filter((l) => l.category === 'Sales');
    let totalRoomNights = 0, totalRevenue = 0, wonCount = 0, lostCount = 0;
    sl.forEach((l) => {
      totalRoomNights += l.totalRoomNights || 0;
      totalRevenue += (l.actualClosedRevenue || l.potentialRevenue || 0);
      if (l.salesStatus === 'Closed Definite') wonCount++;
      else if (l.salesStatus === 'Lost') lostCount++;
    });
    return { leadCount: sl.length, totalRoomNights, totalRevenue, wonCount, lostCount };
  }, [logs]);

  const complaintMetrics = useMemo(() => {
    const cl = logs.filter((l) => l.category === 'Complaint');
    return {
      total: cl.length,
      open: cl.filter((l) => l.complaintStatus === 'Open').length,
      inProgress: cl.filter((l) => l.complaintStatus === 'In Progress').length,
      resolved: cl.filter((l) => l.complaintStatus === 'Resolved').length,
    };
  }, [logs]);

  const miscMetrics = useMemo(() => ({
    total: logs.filter((l) => l.category === 'Miscellaneous').length,
  }), [logs]);

  /* ----- Filtered lists ----- */
  const salesLeads = useMemo(() => {
    return logs.filter((l) => {
      if (l.category !== 'Sales') return false;
      if (subCategoryFilter !== 'All' && l.subCategory !== subCategoryFilter) return false;
      return true;
    });
  }, [logs, subCategoryFilter]);

  const filteredComplaints = useMemo(() => {
    return logs.filter((l) => {
      if (l.category !== 'Complaint') return false;
      if (statusFilter !== 'All' && l.complaintStatus !== statusFilter) return false;
      if (subCategoryFilter !== 'All' && l.subCategory !== subCategoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          l.name?.toLowerCase().includes(q) ||
          l.phoneNumber?.toLowerCase().includes(q) ||
          l.roomNumber?.toLowerCase().includes(q) ||
          l.reservationNumber?.toLowerCase().includes(q) ||
          l.clerkNotes?.toLowerCase().includes(q) ||
          l.subCategory?.toLowerCase().includes(q) ||
          false
        );
      }
      return true;
    });
  }, [logs, statusFilter, subCategoryFilter, searchQuery]);

  const filteredMisc = useMemo(() => {
    return logs.filter((l) => {
      if (l.category !== 'Miscellaneous') return false;
      if (subCategoryFilter !== 'All' && l.subCategory !== subCategoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          l.topic?.toLowerCase().includes(q) ||
          l.clerkNotes?.toLowerCase().includes(q) ||
          l.subCategory?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [logs, subCategoryFilter, searchQuery]);

  const filteredCustomCategoryLogs = useMemo(() => {
    if (!activeCustomCategory) return [];
    return logs.filter((l) => {
      if (l.category !== activeCustomCategory.name) return false;
      if (subCategoryFilter !== 'All' && l.subCategory !== subCategoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          l.topic?.toLowerCase().includes(q) ||
          l.clerkNotes?.toLowerCase().includes(q) ||
          l.subCategory?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [logs, activeCustomCategory, subCategoryFilter, searchQuery]);

  /* ----- Actions ----- */
  const handleUpdateComplaintStatus = async (entry: ShiftLogEntry, status: ComplaintStatus) => {
    const prevStatus = entry.complaintStatus || 'Open';
    if (prevStatus === status) return;

    const transitionId = `status_${entry.id}_${Date.now()}`;
    const timestamp = new Date().toISOString();

    const newStatusChange: ShiftLogStatusChange = {
      id: transitionId,
      fromStatus: prevStatus,
      toStatus: status,
      changedBy: currentUser.fullName,
      changedByRole: currentUser.role,
      timestamp,
    };

    const updated: ShiftLogEntry = {
      ...entry,
      complaintStatus: status,
      statusHistory: [...(entry.statusHistory || []), newStatusChange],
      updatedAt: timestamp,
    };

    await db.saveShiftLog(updated);
    p2pSyncManager.broadcastShiftLog(updated);

    const title = entry.topic || entry.name || `Complaint #${entry.id.substring(0, 6)}`;
    const activityEvent: ActivityLogEvent = {
      id: transitionId,
      type: 'status',
      logId: entry.id,
      category: 'Complaint',
      subCategory: entry.subCategory,
      logTitle: title,
      actor: currentUser.fullName,
      actorRole: currentUser.role,
      summary: `Complaint marked as ${status} (from ${prevStatus})`,
      detail: entry.clerkNotes,
      timestamp,
      badgeText: status,
      badgeColor: status === 'Resolved'
        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
        : status === 'In Progress'
        ? 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
        : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    };

    try {
      await db.saveActivityEvent(activityEvent);
      p2pSyncManager.broadcastActivityEvent(activityEvent);
      await loadPersistedActivityEvents();
    } catch (e) {
      console.error('Failed to log activity event:', e);
    }

    onRefresh();
  };

  const handleAddReply = async (entry: ShiftLogEntry) => {
    if (!replyText.trim()) return;
    const newResp = {
      id: `resp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      authorId: currentUser.id,
      authorName: currentUser.fullName,
      authorRole: currentUser.role,
      message: replyText.trim(),
      createdAt: new Date().toISOString(),
    };
    const updated: ShiftLogEntry = {
      ...entry,
      responses: [...(entry.responses || []), newResp],
      updatedAt: new Date().toISOString(),
    };
    await db.saveShiftLog(updated);
    p2pSyncManager.broadcastShiftLog(updated);

    const title = entry.topic || entry.name || `${entry.category} Log`;
    const replyEvent: ActivityLogEvent = {
      id: `act_${newResp.id}`,
      type: 'reply',
      logId: entry.id,
      category: entry.category,
      subCategory: entry.subCategory,
      logTitle: title,
      actor: currentUser.fullName,
      actorRole: currentUser.role,
      summary: `Replied on "${title}"`,
      detail: newResp.message,
      timestamp: newResp.createdAt,
      badgeText: 'Reply',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    };
    try {
      await db.saveActivityEvent(replyEvent);
      p2pSyncManager.broadcastActivityEvent(replyEvent);
      await loadPersistedActivityEvents();
    } catch (e) {}

    setReplyText('');
    setReplyingTo(null);
    onRefresh();
  };

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleUpdateSalesStatus = async (entry: ShiftLogEntry, status: SalesLeadStatus) => {
    const prevStatus = entry.salesStatus || 'New Lead';
    if (prevStatus === status) return;

    const transitionId = `sales_status_${entry.id}_${Date.now()}`;
    const timestamp = new Date().toISOString();

    const newStatusChange: ShiftLogStatusChange = {
      id: transitionId,
      fromStatus: prevStatus,
      toStatus: status,
      changedBy: currentUser.fullName,
      changedByRole: currentUser.role,
      timestamp,
    };

    const updated: ShiftLogEntry = {
      ...entry,
      salesStatus: status,
      statusHistory: [...(entry.statusHistory || []), newStatusChange],
      updatedAt: timestamp,
    };

    await db.saveShiftLog(updated);
    p2pSyncManager.broadcastShiftLog(updated);

    const title = entry.name || entry.topic || `Sales Lead #${entry.id.substring(0, 6)}`;
    const activityEvent: ActivityLogEvent = {
      id: transitionId,
      type: 'status',
      logId: entry.id,
      category: 'Sales',
      subCategory: entry.subCategory,
      logTitle: title,
      actor: currentUser.fullName,
      actorRole: currentUser.role,
      summary: `Sales lead status updated to ${status} (from ${prevStatus})`,
      detail: entry.clerkNotes,
      timestamp,
      badgeText: status,
      badgeColor: status === 'Closed Definite'
        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
        : status === 'Lost'
        ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
        : 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    };

    try {
      await db.saveActivityEvent(activityEvent);
      p2pSyncManager.broadcastActivityEvent(activityEvent);
      await loadPersistedActivityEvents();
    } catch (e) {}

    onRefresh();
  };

  const handleActivityReply = async (entry: ShiftLogEntry) => {
    const text = (activityReplyText[entry.id] || '').trim();
    if (!text) return;
    const newResp = {
      id: `resp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      authorId: currentUser.id,
      authorName: currentUser.fullName,
      authorRole: currentUser.role,
      message: text,
      createdAt: new Date().toISOString(),
    };
    const updated: ShiftLogEntry = {
      ...entry,
      responses: [...(entry.responses || []), newResp],
      updatedAt: new Date().toISOString(),
    };
    await db.saveShiftLog(updated);
    p2pSyncManager.broadcastShiftLog(updated);

    const title = entry.topic || entry.name || `${entry.category} Log`;
    const replyEvent: ActivityLogEvent = {
      id: `act_${newResp.id}`,
      type: 'reply',
      logId: entry.id,
      category: entry.category,
      subCategory: entry.subCategory,
      logTitle: title,
      actor: currentUser.fullName,
      actorRole: currentUser.role,
      summary: `Replied on "${title}"`,
      detail: newResp.message,
      timestamp: newResp.createdAt,
      badgeText: 'Reply',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    };
    try {
      await db.saveActivityEvent(replyEvent);
      p2pSyncManager.broadcastActivityEvent(replyEvent);
      await loadPersistedActivityEvents();
    } catch (e) {}

    setActivityReplyText((prev) => ({ ...prev, [entry.id]: '' }));
    onRefresh();
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
      if (diff < 60) return 'Just now';
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      if (diff < 172800) return 'Yesterday';
      return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return isoString;
    }
  };

  /* ----- Inline Card Reminder Handlers ----- */
  const setQuickReminderPreset = (hoursFromNow: number) => {
    const target = new Date(Date.now() + hoursFromNow * 3600 * 1000);
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    const hours = String(target.getHours()).padStart(2, '0');
    const mins = String(target.getMinutes()).padStart(2, '0');
    setReminderDateInput(`${year}-${month}-${day}T${hours}:${mins}`);
  };

  const handleSaveReminder = async (entry: ShiftLogEntry) => {
    if (!reminderDateInput) return;
    const updated: ShiftLogEntry = {
      ...entry,
      hasReminder: true,
      reminderDate: reminderDateInput,
      reminderNote: reminderNoteInput.trim() || undefined,
      isReminderCompleted: false,
      updatedAt: new Date().toISOString(),
    };
    await db.saveShiftLog(updated);
    p2pSyncManager.broadcastShiftLog(updated);

    const title = entry.topic || entry.name || `${entry.category} Log`;
    const reminderEvent: ActivityLogEvent = {
      id: `reminder_${entry.id}_${Date.now()}`,
      type: 'reminder',
      logId: entry.id,
      category: entry.category,
      subCategory: entry.subCategory,
      logTitle: title,
      actor: currentUser.fullName,
      actorRole: currentUser.role,
      summary: `Follow-up reminder set for ${formatReminderDate(reminderDateInput)}: ${reminderNoteInput.trim() || 'Follow-up scheduled'}`,
      detail: reminderNoteInput.trim() || undefined,
      timestamp: new Date().toISOString(),
      badgeText: 'Reminder',
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    };
    try {
      await db.saveActivityEvent(reminderEvent);
      p2pSyncManager.broadcastActivityEvent(reminderEvent);
      await loadPersistedActivityEvents();
    } catch (e) {}

    setReminderTargetLogId(null);
    onRefresh();
  };

  const handleClearReminder = async (entry: ShiftLogEntry) => {
    const updated: ShiftLogEntry = {
      ...entry,
      hasReminder: false,
      reminderDate: undefined,
      reminderNote: undefined,
      isReminderCompleted: true,
      updatedAt: new Date().toISOString(),
    };
    await db.saveShiftLog(updated);
    p2pSyncManager.broadcastShiftLog(updated);
    setReminderTargetLogId(null);
    onRefresh();
  };

  const formatReminderDate = (isoOrDateString?: string) => {
    if (!isoOrDateString) return 'Reminder';
    try {
      const d = new Date(isoOrDateString);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoOrDateString;
    }
  };

  /* ----- Unified Recent Activity Feed (Replies, Status Changes, Reminders & Logs) ----- */
  const recentActivityFeed = useMemo(() => {
    const itemMap = new Map<string, ActivityLogEvent>();

    // 1. Add all persisted audit events (which includes manager deletions, tracked status updates, etc.)
    persistedEvents.forEach((pe) => {
      if (pe && pe.id) itemMap.set(pe.id, pe);
    });

    // 2. Synthesize events from active logs
    logs.forEach((log) => {
      const title = log.topic || log.name || `${log.category} Log`;

      // 1. Creation event
      const createdId = `created_${log.id}`;
      if (!itemMap.has(createdId)) {
        itemMap.set(createdId, {
          id: createdId,
          type: 'created',
          logId: log.id,
          category: log.category,
          subCategory: log.subCategory,
          logTitle: title,
          actor: log.clerkName || 'Staff',
          actorRole: log.clerkRole,
          summary: `Created ${log.category.toLowerCase()} log: "${title}"`,
          detail: log.clerkNotes || log.topic,
          timestamp: log.createdAt,
          badgeText: 'New Log',
          badgeColor: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        });
      }

      // Status history transitions
      if (log.statusHistory && log.statusHistory.length > 0) {
        log.statusHistory.forEach((sh) => {
          if (!itemMap.has(sh.id)) {
            const isResolved = sh.toStatus === 'Resolved' || sh.toStatus === 'Closed Definite';
            itemMap.set(sh.id, {
              id: sh.id,
              type: 'status',
              logId: log.id,
              category: log.category,
              subCategory: log.subCategory,
              logTitle: title,
              actor: sh.changedBy || 'Staff',
              actorRole: sh.changedByRole,
              summary: `${log.category} status marked as ${sh.toStatus} (from ${sh.fromStatus})`,
              detail: log.clerkNotes,
              timestamp: sh.timestamp,
              badgeText: sh.toStatus,
              badgeColor: isResolved
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                : 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
            });
          }
        });
      } else if (log.updatedAt && log.updatedAt !== log.createdAt) {
        // Fallback for legacy logs without statusHistory array
        if (log.category === 'Complaint' && log.complaintStatus) {
          const fallbackId = `status_${log.id}_${log.updatedAt}`;
          if (!itemMap.has(fallbackId)) {
            itemMap.set(fallbackId, {
              id: fallbackId,
              type: 'status',
              logId: log.id,
              category: log.category,
              subCategory: log.subCategory,
              logTitle: title,
              actor: log.clerkName || 'Staff',
              summary: `Complaint marked as ${log.complaintStatus}`,
              detail: log.clerkNotes,
              timestamp: log.updatedAt,
              badgeText: log.complaintStatus,
              badgeColor: log.complaintStatus === 'Resolved'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                : 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
            });
          }
        } else if (log.category === 'Sales' && log.salesStatus) {
          const fallbackId = `sales_status_${log.id}_${log.updatedAt}`;
          if (!itemMap.has(fallbackId)) {
            itemMap.set(fallbackId, {
              id: fallbackId,
              type: 'status',
              logId: log.id,
              category: log.category,
              subCategory: log.subCategory,
              logTitle: title,
              actor: log.clerkName || 'Staff',
              summary: `Lead progress: ${log.salesStatus}`,
              timestamp: log.updatedAt,
              badgeText: log.salesStatus,
              badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
            });
          }
        }
      }

      // 2. Replies / Comments events
      if (log.responses && log.responses.length > 0) {
        log.responses.forEach((r) => {
          const replyId = `act_${r.id}`;
          if (!itemMap.has(replyId)) {
            itemMap.set(replyId, {
              id: replyId,
              type: 'reply',
              logId: log.id,
              category: log.category,
              subCategory: log.subCategory,
              logTitle: title,
              actor: r.authorName,
              actorRole: r.authorRole,
              summary: `Replied on "${title}"`,
              detail: r.message,
              timestamp: r.createdAt,
              badgeText: 'Reply',
              badgeColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
            });
          }
        });
      }

      // 3. Follow-up Reminders
      if (log.hasReminder && log.reminderDate) {
        const reminderId = `reminder_${log.id}_${log.reminderDate}`;
        if (!itemMap.has(reminderId)) {
          itemMap.set(reminderId, {
            id: reminderId,
            type: 'reminder',
            logId: log.id,
            category: log.category,
            subCategory: log.subCategory,
            logTitle: title,
            actor: log.clerkName || 'Staff',
            summary: `Follow-up reminder: ${log.reminderNote || 'Follow-up scheduled'}`,
            detail: `Due: ${new Date(log.reminderDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
            timestamp: log.updatedAt || log.createdAt,
            badgeText: 'Reminder',
            badgeColor: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
          });
        }
      }
    });

    const items = Array.from(itemMap.values());
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (activityFeedFilter === 'Replies') return items.filter((i) => i.type === 'reply');
    if (activityFeedFilter === 'Status') return items.filter((i) => i.type === 'status');
    if (activityFeedFilter === 'Reminders') return items.filter((i) => i.type === 'reminder');
    if (activityFeedFilter === 'Created') return items.filter((i) => i.type === 'created');
    if (activityFeedFilter === 'Deleted') return items.filter((i) => i.type === 'deleted');

    return items;
  }, [logs, persistedEvents, activityFeedFilter]);

  const getActivityIconConfig = (entry: ShiftLogEntry) => {
    if (entry.category === 'Sales') {
      switch (entry.subCategory) {
        case 'Wedding':
          return {
            icon: <Heart className="w-4 h-4 text-rose-600" />,
            badge: 'bg-rose-50 border-rose-200 text-rose-700',
            label: 'Wedding Lead',
          };
        case 'Sports team':
          return {
            icon: <Trophy className="w-4 h-4 text-amber-600" />,
            badge: 'bg-amber-50 border-amber-200 text-amber-700',
            label: 'Sports Team',
          };
        case 'Company':
          return {
            icon: <Briefcase className="w-4 h-4 text-blue-600" />,
            badge: 'bg-blue-50 border-blue-200 text-blue-700',
            label: 'Corporate Lead',
          };
        case 'Group':
        default:
          return {
            icon: <Users className="w-4 h-4 text-emerald-600" />,
            badge: 'bg-emerald-50 border-emerald-200 text-emerald-700',
            label: 'Group Lead',
          };
      }
    }
    if (entry.category === 'Complaint') {
      return {
        icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
        badge: 'bg-amber-50 border-amber-200 text-amber-700',
        label: 'Guest Complaint',
      };
    }
    return {
      icon: <Tag className="w-4 h-4 text-indigo-600" />,
      badge: 'bg-indigo-50 border-indigo-200 text-indigo-700',
      label: 'Shift Note',
    };
  };

  const filteredRecentLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter((l) => {
      return (
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.topic && l.topic.toLowerCase().includes(q)) ||
        (l.clerkNotes && l.clerkNotes.toLowerCase().includes(q)) ||
        (l.clerkName && l.clerkName.toLowerCase().includes(q)) ||
        (l.subCategory && l.subCategory.toLowerCase().includes(q)) ||
        (l.phoneNumber && l.phoneNumber.toLowerCase().includes(q)) ||
        (l.roomNumber && l.roomNumber.toLowerCase().includes(q))
      );
    });
  }, [logs, searchQuery]);

  /* ================================================================
     RECENT ACTIVITY & UPDATES CARD (Stream of changes, replies & status)
  ================================================================ */
  const renderRecentActivityCard = () => (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 sm:p-4 shadow-xs space-y-3">
      <div className="border-b border-gray-100 dark:border-gray-700 pb-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-md border border-blue-200 dark:border-blue-900">
              <Activity className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center space-x-1.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">Recent Activity</h3>
              <span className="text-[10px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-1.5 py-0.2 rounded-full font-mono tabular-nums">
                {recentActivityFeed.length}
              </span>
            </div>
          </div>
          <span className="text-[10px] text-gray-400 dark:text-gray-400">Live stream</span>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1">
          {(['All', 'Replies', 'Status', 'Reminders', 'Created', 'Deleted'] as const).map((filterType) => (
            <button
              key={filterType}
              type="button"
              onClick={() => setActivityFeedFilter(filterType)}
              className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition cursor-pointer ${
                activityFeedFilter === filterType
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                  : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200/70'
              }`}
            >
              {filterType === 'All' ? 'All' :
               filterType === 'Replies' ? 'Replies' :
               filterType === 'Status' ? 'Status' :
               filterType === 'Reminders' ? 'Reminders' : 
               filterType === 'Deleted' ? 'Deleted' : 'New'}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Stream Feed - Compact and Sleek */}
      <div className="space-y-1.5 max-h-[640px] overflow-y-auto pr-0.5">
        {recentActivityFeed.length === 0 ? (
          <div className="py-6 text-center text-gray-400 text-xs">
            No recent changes recorded yet. When staff reply, update statuses, or set reminders, they will appear here.
          </div>
        ) : (
          recentActivityFeed.slice(0, 50).map((act) => (
            <div
              key={act.id}
              onClick={() => {
                if (act.type !== 'deleted') {
                  setExpandedActivityId(act.logId);
                }
              }}
              className="p-2 sm:p-2.5 bg-gray-50/80 dark:bg-gray-700/30 hover:bg-blue-50/50 dark:hover:bg-gray-700/70 border border-gray-200/80 dark:border-gray-700 rounded-lg transition-colors cursor-pointer group"
            >
              {/* Row 1: Icon + Actor + Badge + Timestamp */}
              <div className="flex items-center justify-between gap-1.5 mb-1">
                <div className="flex items-center space-x-1.5 min-w-0">
                  <div className="p-0.5 rounded bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-600 text-gray-700 dark:text-gray-300 shrink-0">
                    {act.type === 'reply' ? (
                      <MessageSquare className="w-3 h-3 text-blue-600" />
                    ) : act.type === 'status' ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    ) : act.type === 'reminder' ? (
                      <Bell className="w-3 h-3 text-amber-600" />
                    ) : act.type === 'deleted' ? (
                      <Trash2 className="w-3 h-3 text-rose-600" />
                    ) : (
                      <FileText className="w-3 h-3 text-slate-600" />
                    )}
                  </div>
                  <span className="font-bold text-xs text-gray-900 dark:text-white truncate">
                    {act.actor}
                  </span>
                  <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded border ${act.badgeColor} shrink-0`}>
                    {act.badgeText}
                  </span>
                </div>

                <span className="text-[10px] text-gray-400 dark:text-gray-400 font-mono tabular-nums shrink-0 flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5 text-gray-400" />
                  {formatRelativeTime(act.timestamp)}
                </span>
              </div>

              {/* Row 2: Summary & Detail (Inline & compact) */}
              <div className="text-[11px] text-gray-600 dark:text-gray-300 pl-4.5 truncate">
                <span className="font-medium text-gray-800 dark:text-gray-200">{act.summary}</span>
                {act.detail && (
                  <span className="text-gray-500 dark:text-gray-400 italic ml-1">
                    "{act.detail}"
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  /* ================================================================
     OVERVIEW — 3 Summary Cards
  ================================================================ */
  const renderOverview = () => (
    <div className="space-y-5">
      {/* Search bar */}
      <div className="flex items-center space-x-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search leads, complaints, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>
        <button
          onClick={() => onOpenNewModal('Sales')}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Log</span>
        </button>
      </div>

      {/* Summary Cards Grid (Sales, Complaints, Shift Notes + Any Custom Categories) */}
      <div
        className={
          customCategories.length === 0
            ? 'grid grid-cols-1 md:grid-cols-3 gap-4'
            : customCategories.length === 1
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'
            : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
        }
      >
        {/* SALES CARD */}
        {(() => {
          const salesCat = categories.find((c) => c.name === 'Sales');
          const SalesIcon = getCategoryIconComponent(salesCat?.icon, 'Building2');
          return (
            <button
              onClick={() => setActiveView('sales-kanban')}
              className="text-left w-full group bg-white border border-gray-200 hover:border-blue-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                      <SalesIcon className="w-4 h-4 text-emerald-700" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Sales Pipeline</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-3xl font-extrabold text-gray-900">{salesMetrics.leadCount}</p>
                <p className="text-xs text-gray-500 mt-0.5">Total group leads</p>
                <div className="flex items-center space-x-2 mt-3">
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" /><span>Won: {salesMetrics.wonCount}</span>
                  </span>
                  <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full inline-flex items-center space-x-1">
                    <XCircle className="w-3 h-3" /><span>Lost: {salesMetrics.lostCount}</span>
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <div>
                  <p className="text-gray-400 font-medium">Room Nights</p>
                  <p className="font-extrabold text-gray-800">{salesMetrics.totalRoomNights}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 font-medium">Est. Revenue</p>
                  <p className="font-extrabold text-emerald-700 text-sm">${salesMetrics.totalRevenue.toLocaleString()}</p>
                </div>
              </div>
            </button>
          );
        })()}

        {/* COMPLAINTS CARD */}
        {(() => {
          const complaintCat = categories.find((c) => c.name === 'Complaint');
          const ComplaintIcon = getCategoryIconComponent(complaintCat?.icon, 'AlertTriangle');
          return (
            <button
              onClick={() => setActiveView('complaints')}
              className="text-left w-full group bg-white border border-gray-200 hover:border-rose-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center">
                      <ComplaintIcon className="w-4 h-4 text-rose-700" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Complaints</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-rose-500 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-3xl font-extrabold text-gray-900">{complaintMetrics.total}</p>
                <p className="text-xs text-gray-500 mt-0.5">Guest complaints reported</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  <span className="text-[11px] font-semibold bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full">Open: {complaintMetrics.open}</span>
                  <span className="text-[11px] font-semibold bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full">Progress: {complaintMetrics.inProgress}</span>
                  <span className="text-[11px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full">Resolved: {complaintMetrics.resolved}</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-400 font-medium">Service recovery rate</span>
                <span className="font-extrabold text-gray-900">
                  {complaintMetrics.total > 0 ? `${Math.round((complaintMetrics.resolved / complaintMetrics.total) * 100)}%` : '100%'}
                </span>
              </div>
            </button>
          );
        })()}

        {/* MISC CARD */}
        {(() => {
          const miscCat = categories.find((c) => c.name === 'Miscellaneous');
          const MiscIcon = getCategoryIconComponent(miscCat?.icon, 'Tag');
          return (
            <button
              onClick={() => setActiveView('misc')}
              className="text-left w-full group bg-white border border-gray-200 hover:border-indigo-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                      <MiscIcon className="w-4 h-4 text-indigo-700" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">Shift Notes</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-3xl font-extrabold text-gray-900">{miscMetrics.total}</p>
                <p className="text-xs text-gray-500 mt-0.5">Logged handover notes</p>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-400 font-medium">Handover status</span>
                <span className="font-extrabold text-emerald-700">Active</span>
              </div>
            </button>
          );
        })()}

        {/* DYNAMIC CUSTOM CATEGORIES BOXES */}
        {customCategories.map((cat) => {
          const catLogs = logs.filter((l) => l.category === cat.name);
          const CustomIcon = getCategoryIconComponent(cat.icon, 'Tag');
          return (
            <button
              key={cat.id}
              onClick={() => {
                setActiveView(cat.name);
                setSubCategoryFilter('All');
              }}
              className="text-left w-full group bg-white border border-gray-200 hover:border-purple-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center">
                      <CustomIcon className="w-4 h-4 text-purple-700" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-700">{cat.name}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-purple-500 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-3xl font-extrabold text-gray-900">{catLogs.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">Logged {cat.name.toLowerCase()} entries</p>
                <div className="flex flex-wrap items-center gap-1 mt-3">
                  {cat.subcategories.slice(0, 3).map((sub) => (
                    <span
                      key={sub}
                      className="text-[10px] font-semibold bg-purple-50 border border-purple-200 text-purple-700 px-2 py-0.5 rounded-full"
                    >
                      {sub}
                    </span>
                  ))}
                  {cat.subcategories.length > 3 && (
                    <span className="text-[10px] text-gray-400">+{cat.subcategories.length - 3}</span>
                  )}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-400 font-medium">Subcategories</span>
                <span className="font-extrabold text-purple-700">{cat.subcategories.length}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* -------------------- SIDE-BY-SIDE: SHIFT LOGS FEED (LEFT) & RECENT ACTIVITY (RIGHT) -------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: MAIN SHIFT LOG CARDS STREAM (7 cols on desktop) */}
        <div className="lg:col-span-7 xl:col-span-7 space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
              Shift Logs Feed (<span className="font-mono tabular-nums">{filteredRecentLogs.length}</span>)
            </h4>
            <span className="text-[11px] text-gray-400">Click any card to inspect full details or reply</span>
          </div>

        {/* Activity Items List */}
        <div className="space-y-2 pt-1">
          {filteredRecentLogs.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-xs">
              No recent activity matching your filter.
            </div>
          ) : (
            filteredRecentLogs.slice(0, 10).map((entry) => {
              const isExpanded = expandedActivityId === entry.id;
              const config = getActivityIconConfig(entry);
              const responsesCount = entry.responses?.length || 0;

              return (
                <div
                  key={entry.id}
                  className="border border-gray-200 rounded-xl bg-white hover:border-blue-200 transition-all duration-150 overflow-hidden shadow-xs"
                >
                  {/* Top Bar / Row */}
                  <div
                    onClick={() => setExpandedActivityId(isExpanded ? null : entry.id)}
                    className="p-3 sm:px-4 cursor-pointer flex items-center justify-between gap-3 hover:bg-gray-50/60 transition"
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      {/* Prominent Quick-Identify Icon Badge */}
                      <div className={`p-2 rounded-lg border flex-shrink-0 ${config.badge}`}>
                        {config.icon}
                      </div>

                      {/* Title & Key Tags */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                          <p className="text-sm font-bold text-gray-900 truncate">
                            {entry.topic || entry.name || `${entry.category} Log`}
                          </p>

                          {/* Subcategory Pill */}
                          {entry.subCategory && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-700">
                              {entry.subCategory}
                            </span>
                          )}

                          {/* Status Pill */}
                          {entry.category === 'Sales' && entry.salesStatus && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              entry.salesStatus === 'Closed Definite' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                              entry.salesStatus === 'Processing' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                              entry.salesStatus === 'Lost' ? 'bg-gray-100 border-gray-200 text-gray-600' :
                              'bg-blue-50 border-blue-200 text-blue-700'
                            }`}>
                              {entry.salesStatus}
                            </span>
                          )}

                          {entry.category === 'Complaint' && (
                            <div 
                              className="relative inline-flex items-center" 
                              onClick={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              <select
                                value={entry.complaintStatus || 'Open'}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleUpdateComplaintStatus(entry, e.target.value as ComplaintStatus);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                                className={`text-[11px] font-bold py-0.5 pl-2 pr-5 rounded-md border transition cursor-pointer appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                                  (entry.complaintStatus || 'Open') === 'Resolved'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                    : (entry.complaintStatus || 'Open') === 'In Progress'
                                    ? 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                                    : 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                                }`}
                              >
                                <option value="Open">Status: Open</option>
                                <option value="In Progress">Status: In Progress</option>
                                <option value="Resolved">Status: Resolved</option>
                              </select>
                              <ChevronDown className="w-3 h-3 text-current absolute right-1 pointer-events-none opacity-60" />
                            </div>
                          )}

                          {/* Room or Revenue summary */}
                          {(entry.potentialRevenue || 0) > 0 && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 tabular-nums">
                              ${entry.potentialRevenue?.toLocaleString()}
                            </span>
                          )}

                          {entry.roomNumber && (
                            <span className="text-[10px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                              Room {entry.roomNumber}
                            </span>
                          )}

                          {/* Interactive Card Reminder Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (reminderTargetLogId === entry.id) {
                                setReminderTargetLogId(null);
                              } else {
                                setReminderTargetLogId(entry.id);
                                setReminderDateInput(entry.reminderDate || '');
                                setReminderNoteInput(entry.reminderNote || '');
                              }
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            title={entry.hasReminder ? 'Edit follow-up reminder' : 'Set follow-up reminder'}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border transition cursor-pointer ${
                              entry.hasReminder && !entry.isReminderCompleted
                                ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 hover:bg-amber-100'
                                : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:text-amber-700 hover:border-amber-300'
                            }`}
                          >
                            <Bell className={`w-3.5 h-3.5 ${entry.hasReminder && !entry.isReminderCompleted ? 'text-amber-600 fill-amber-500/20' : 'text-gray-400'}`} />
                            <span>{entry.hasReminder && entry.reminderDate ? formatReminderDate(entry.reminderDate) : 'Reminder'}</span>
                          </button>
                        </div>

                        {/* Subline: author & full timestamp */}
                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{entry.clerkName}</span>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-gray-600 dark:text-gray-300">
                            <Clock className="w-3 h-3 text-blue-500 shrink-0" />
                            {formatFullTimestamp(entry.createdAt)}
                          </span>
                          <span className="text-[11px] text-gray-400">({formatRelativeTime(entry.createdAt)})</span>
                          {responsesCount > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-blue-600 dark:text-blue-400 font-semibold inline-flex items-center space-x-0.5">
                                <MessageSquare className="w-3 h-3" />
                                <span>{responsesCount} actions</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expand/Collapse Chevron */}
                    <div className="flex items-center space-x-2 text-gray-400">
                      <span className="text-[11px] font-medium hidden sm:inline text-blue-600">
                        {isExpanded ? 'Collapse' : 'Details & Reply'}
                      </span>
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-600" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>

                  {/* Inline Quick Reminder Drawer for this Card */}
                  {reminderTargetLogId === entry.id && (
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      className="bg-amber-50/70 dark:bg-amber-950/30 border-t border-b border-amber-200 dark:border-amber-800/60 p-3.5 space-y-3 animate-in fade-in"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                          <Bell className="w-3.5 h-3.5 text-amber-600" />
                          <span>Set Follow-Up Reminder for this Card</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setQuickReminderPreset(1)}
                            className="px-2 py-0.5 bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800 rounded text-amber-800 dark:text-amber-200 hover:bg-amber-100 transition cursor-pointer"
                          >
                            +1 Hour
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuickReminderPreset(4)}
                            className="px-2 py-0.5 bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800 rounded text-amber-800 dark:text-amber-200 hover:bg-amber-100 transition cursor-pointer"
                          >
                            +4 Hours
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuickReminderPreset(24)}
                            className="px-2 py-0.5 bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800 rounded text-amber-800 dark:text-amber-200 hover:bg-amber-100 transition cursor-pointer"
                          >
                            Tomorrow
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider mb-1">
                            Date & Time
                          </label>
                          <input
                            type="datetime-local"
                            value={reminderDateInput}
                            onChange={(e) => setReminderDateInput(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider mb-1">
                            Reminder Note / Action
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Call guest back, follow up on AC repair..."
                            value={reminderNoteInput}
                            onChange={(e) => setReminderNoteInput(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div>
                          {entry.hasReminder && (
                            <button
                              type="button"
                              onClick={() => handleClearReminder(entry)}
                              className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                            >
                              Clear Reminder
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setReminderTargetLogId(null)}
                            className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-50 transition cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={!reminderDateInput}
                            onClick={() => handleSaveReminder(entry)}
                            className="px-3.5 py-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition flex items-center space-x-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Save Reminder</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Expanded Detail View */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50/60 p-4 space-y-3.5">
                      {/* Meta Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        {entry.phone && (
                          <div className="bg-white p-2 rounded-lg border border-gray-200">
                            <span className="text-gray-400 block text-[10px]">Phone</span>
                            <span className="font-semibold text-gray-800">{entry.phone}</span>
                          </div>
                        )}
                        {entry.email && (
                          <div className="bg-white p-2 rounded-lg border border-gray-200">
                            <span className="text-gray-400 block text-[10px]">Email</span>
                            <span className="font-semibold text-gray-800 truncate block">{entry.email}</span>
                          </div>
                        )}
                        {entry.totalRoomNights && (
                          <div className="bg-white p-2 rounded-lg border border-gray-200">
                            <span className="text-gray-400 block text-[10px]">Room Nights</span>
                            <span className="font-semibold text-gray-800">{entry.totalRoomNights} nights ({entry.roomRequirement || 0} rooms)</span>
                          </div>
                        )}
                        {entry.reservationNumber && (
                          <div className="bg-white p-2 rounded-lg border border-gray-200">
                            <span className="text-gray-400 block text-[10px]">Reservation #</span>
                            <span className="font-semibold text-gray-800">{entry.reservationNumber}</span>
                          </div>
                        )}
                        {entry.customFields && Object.entries(entry.customFields).map(([k, v]) => (
                          <div key={k} className="bg-white p-2 rounded-lg border border-blue-200">
                            <span className="text-blue-600 block text-[10px] font-bold">Custom Field</span>
                            <span className="font-semibold text-gray-800 block truncate">{v}</span>
                          </div>
                        ))}
                      </div>

                      {/* Clerk Notes Callout */}
                      {entry.clerkNotes && (
                        <div className="bg-white border-l-2 border-blue-500 rounded-r-lg p-3 text-xs text-gray-700 shadow-2xs">
                          <p className="font-semibold text-[10px] uppercase tracking-wider text-gray-400 mb-1">Clerk Notes</p>
                          <p className="whitespace-pre-wrap leading-relaxed">{entry.clerkNotes}</p>
                        </div>
                      )}

                      {/* Inline Status Updater & Action Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-200">
                        {/* Status Updater */}
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500 font-medium">Update Status:</span>
                          {entry.category === 'Sales' && (
                            <select
                              value={entry.salesStatus || 'New Lead'}
                              onChange={(e) => handleUpdateSalesStatus(entry, e.target.value as SalesLeadStatus)}
                              className="text-xs bg-white border border-gray-300 rounded-lg px-2.5 py-1 font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="New Lead">1. New Lead</option>
                              <option value="Processing">2. Processing</option>
                              <option value="Closed Definite">3. Closed Definite (Won)</option>
                              <option value="Lost">4. Lost</option>
                            </select>
                          )}

                          {entry.category === 'Complaint' && (
                            <select
                              value={entry.complaintStatus || 'Open'}
                              onChange={(e) => handleUpdateComplaintStatus(entry, e.target.value as ComplaintStatus)}
                              className="text-xs bg-white border border-gray-300 rounded-lg px-2.5 py-1 font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="Open">Open</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Resolved">Resolved</option>
                            </select>
                          )}
                        </div>

                        {/* View in Dedicated Section Link */}
                        <div className="flex items-center space-x-2">
                          {entry.category === 'Sales' && (
                            <button
                              onClick={() => setActiveView('sales-kanban')}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                            >
                              <span>Open in Sales Kanban</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                          {entry.category === 'Complaint' && (
                            <button
                              onClick={() => setActiveView('complaints')}
                              className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center space-x-1"
                            >
                              <span>Open in Complaints View</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          )}

                          <button
                            onClick={() => onEditLog(entry)}
                            className="p-1 text-gray-400 hover:text-blue-600 rounded"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {currentUser.role === 'manager' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                if (window.confirm('Delete this log entry? (Manager Action)')) onDeleteLog(entry.id);
                              }}
                              className="p-1 text-gray-400 hover:text-rose-600 rounded cursor-pointer"
                              title="Delete (Manager Only)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Threaded Responses Section */}
                      <div className="pt-2 border-t border-gray-200 space-y-2">
                        <p className="text-xs font-bold text-gray-700 flex items-center space-x-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                          <span>Staff Responses ({responsesCount})</span>
                        </p>

                        {responsesCount > 0 ? (
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {entry.responses!.map((r) => (
                              <div key={r.id} className="flex items-start space-x-2 text-xs bg-white p-2.5 rounded-lg border border-gray-200">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
                                  r.authorRole === 'manager' ? 'bg-slate-800 text-white' : 'bg-blue-600 text-white'
                                }`}>
                                  {r.authorName.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="font-bold text-gray-800 dark:text-gray-200">{r.authorName} <span className="text-[10px] text-gray-400 font-normal">({r.authorRole})</span></span>
                                    <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">{formatFullTimestamp(r.createdAt)}</span>
                                  </div>
                                  <p className="text-gray-700">{r.message}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 italic">No responses recorded yet.</p>
                        )}

                        {/* Reply Input Box */}
                        <div className="flex items-center space-x-2 pt-1">
                          <input
                            type="text"
                            placeholder="Add a quick staff reply or update..."
                            value={activityReplyText[entry.id] || ''}
                            onChange={(e) => setActivityReplyText((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleActivityReply(entry);
                            }}
                            className="flex-1 px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            onClick={() => handleActivityReply(entry)}
                            disabled={!(activityReplyText[entry.id] || '').trim()}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition inline-flex items-center space-x-1"
                          >
                            <Send className="w-3 h-3" />
                            <span>Reply</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        </div>

        {/* RIGHT COLUMN: RECENT ACTIVITY STREAM (5 cols on desktop, sticky on scroll) */}
        <div className="lg:col-span-5 xl:col-span-5 lg:sticky lg:top-4 space-y-3">
          {renderRecentActivityCard()}
        </div>
      </div>
    </div>
  );

  /* ================================================================
     SALES KANBAN VIEW
  ================================================================ */
  const renderSalesKanban = () => (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setActiveView('overview')}
            className="text-xs text-gray-500 hover:text-gray-700 font-medium inline-flex items-center space-x-1"
          >
            <ChevronRight className="w-3.5 h-3.5 rotate-180" />
            <span>Back to Overview</span>
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-xs font-bold text-gray-700 flex items-center space-x-1.5">
            <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
            <span>Sales Pipeline — Kanban Board</span>
          </span>
        </div>

        {/* Subcategory Filter for Sales */}
        <div className="flex items-center space-x-2">
          <span className="text-[11px] text-gray-500 font-semibold">Subcategory:</span>
          <select
            value={subCategoryFilter}
            onChange={(e) => setSubCategoryFilter(e.target.value)}
            className="px-2.5 py-1 text-xs bg-white border border-gray-200 rounded-lg text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="All">All Lead Types</option>
            {salesSubcategories.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        </div>
      </div>
      <SalesKanban
        leads={salesLeads}
        currentUser={currentUser}
        onOpenNewModal={() => onOpenNewModal('Sales')}
        onEditLead={onEditLog}
        onDeleteLead={onDeleteLog}
        onRefresh={onRefresh}
      />
    </div>
  );

  /* ================================================================
     COMPLAINTS DETAIL VIEW
  ================================================================ */
  const renderComplaints = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setActiveView('overview')}
            className="text-xs text-gray-500 hover:text-gray-700 font-medium inline-flex items-center space-x-1"
          >
            <ChevronRight className="w-3.5 h-3.5 rotate-180" />
            <span>Back</span>
          </button>
          <span className="text-sm font-bold text-gray-900 flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Guest Complaints ({filteredComplaints.length})</span>
          </span>
        </div>
        <div className="flex items-center space-x-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-400 w-44"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-400"
          >
            <option value="All">All Statuses</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
          </select>
          {/* Subcategory Filter */}
          <select
            value={subCategoryFilter}
            onChange={(e) => setSubCategoryFilter(e.target.value)}
            className="px-2.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-400"
          >
            <option value="All">All Subcategories</option>
            {complaintSubcategories.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
          <button
            onClick={() => onOpenNewModal('Complaint')}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Complaint</span>
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Open', count: complaintMetrics.open, color: 'bg-amber-50 border-amber-200 text-amber-700' },
          { label: 'In Progress', count: complaintMetrics.inProgress, color: 'bg-blue-50 border-blue-200 text-blue-700' },
          { label: 'Resolved', count: complaintMetrics.resolved, color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-3 text-center ${s.color}`}>
            <p className="text-xl font-extrabold">{s.count}</p>
            <p className="text-xs font-semibold mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Complaint cards */}
      {filteredComplaints.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
          <AlertTriangle className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-semibold text-gray-500">No complaints found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredComplaints.map((entry) => {
            const isExpanded = expandedCards.has(entry.id);
            return (
              <div key={entry.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-all">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {/* Status badge */}
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                          entry.complaintStatus === 'Resolved' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' :
                          entry.complaintStatus === 'In Progress' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800' :
                          'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                        }`}>
                          {entry.complaintStatus || 'Open'}
                        </span>
                        {entry.roomNumber && (
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md font-medium">
                            Room {entry.roomNumber}
                          </span>
                        )}
                        {/* Interactive Reminder Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (reminderTargetLogId === entry.id) {
                              setReminderTargetLogId(null);
                            } else {
                              setReminderTargetLogId(entry.id);
                              setReminderDateInput(entry.reminderDate || '');
                              setReminderNoteInput(entry.reminderNote || '');
                            }
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          title={entry.hasReminder ? 'Edit follow-up reminder' : 'Set follow-up reminder'}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border transition cursor-pointer ${
                            entry.hasReminder && !entry.isReminderCompleted
                              ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 hover:bg-amber-100'
                              : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:text-amber-700 hover:border-amber-300'
                          }`}
                        >
                          <Bell className={`w-3.5 h-3.5 ${entry.hasReminder && !entry.isReminderCompleted ? 'text-amber-600 fill-amber-500/20' : 'text-gray-400'}`} />
                          <span>{entry.hasReminder && entry.reminderDate ? formatReminderDate(entry.reminderDate) : 'Reminder'}</span>
                        </button>
                      </div>
                      <h4 className="text-base font-bold text-gray-900">{entry.topic || entry.name || 'Guest Complaint'}</h4>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                        {entry.name && entry.topic && (
                          <span className="flex items-center space-x-1 font-semibold text-gray-700">
                            <User className="w-3.5 h-3.5 text-gray-400" />
                            <span>{entry.name}</span>
                          </span>
                        )}
                        {entry.phoneNumber && (
                          <span className="flex items-center space-x-1"><Phone className="w-3.5 h-3.5" /><span>{entry.phoneNumber}</span></span>
                        )}
                        {entry.reservationNumber && <span>Res: {entry.reservationNumber}</span>}
                      </div>
                      {entry.clerkNotes && (
                        <p className="mt-2 text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 leading-relaxed">{entry.clerkNotes}</p>
                      )}
                      <div className="flex items-center space-x-3 mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                        <span className="flex items-center space-x-1"><User className="w-3 h-3" /><span>{entry.clerkName}</span></span>
                        <span className="flex items-center space-x-1 font-mono">
                          <Clock className="w-3 h-3 text-blue-500" />
                          <span>{formatFullTimestamp(entry.createdAt)}</span>
                        </span>
                      </div>
                    </div>

                    {/* Right: status selector + actions */}
                    <div className="flex flex-col items-end space-y-2 flex-shrink-0">
                      <select
                        value={entry.complaintStatus || 'Open'}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleUpdateComplaintStatus(entry, e.target.value as ComplaintStatus);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        className={`text-xs font-bold py-1.5 px-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-blue-500 transition cursor-pointer ${
                          entry.complaintStatus === 'Resolved' ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' :
                          entry.complaintStatus === 'In Progress' ? 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800' :
                          'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                        }`}
                      >
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                      <div className="flex items-center space-x-1">
                        <button onClick={() => onEditLog(entry)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {currentUser.role === 'manager' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              if (window.confirm('Delete this complaint? (Manager Action)')) onDeleteLog(entry.id);
                            }}
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Delete Complaint (Manager Only)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Inline Reminder Drawer in Complaints View */}
                  {reminderTargetLogId === entry.id && (
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      className="mt-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3.5 space-y-3 animate-in fade-in"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                          <Bell className="w-3.5 h-3.5 text-amber-600" />
                          <span>Set Follow-Up Reminder</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setQuickReminderPreset(1)}
                            className="px-2 py-0.5 bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800 rounded text-amber-800 dark:text-amber-200 hover:bg-amber-100 transition cursor-pointer"
                          >
                            +1h
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuickReminderPreset(4)}
                            className="px-2 py-0.5 bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800 rounded text-amber-800 dark:text-amber-200 hover:bg-amber-100 transition cursor-pointer"
                          >
                            +4h
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuickReminderPreset(24)}
                            className="px-2 py-0.5 bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800 rounded text-amber-800 dark:text-amber-200 hover:bg-amber-100 transition cursor-pointer"
                          >
                            Tomorrow
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider mb-1">
                            Date & Time
                          </label>
                          <input
                            type="datetime-local"
                            value={reminderDateInput}
                            onChange={(e) => setReminderDateInput(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider mb-1">
                            Action Note
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Call guest back..."
                            value={reminderNoteInput}
                            onChange={(e) => setReminderNoteInput(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div>
                          {entry.hasReminder && (
                            <button
                              type="button"
                              onClick={() => handleClearReminder(entry)}
                              className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                            >
                              Clear Reminder
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setReminderTargetLogId(null)}
                            className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-50 transition cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={!reminderDateInput}
                            onClick={() => handleSaveReminder(entry)}
                            className="px-3.5 py-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition flex items-center space-x-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Save Reminder</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Expand button */}
                  <button
                    onClick={() => toggleExpand(entry.id)}
                    className="mt-3 flex items-center space-x-1 text-[11px] text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <span>Responses</span>
                    {(entry.responses?.length || 0) > 0 && (
                      <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1">
                        {entry.responses!.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Threaded Responses */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
                    {(entry.responses?.length || 0) > 0 ? (
                      <div className="space-y-2">
                        {entry.responses!.map((r) => (
                          <div key={r.id} className="flex items-start space-x-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                              r.authorRole === 'manager' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {r.authorName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl p-2.5">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{r.authorName}</span>
                                <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
                                  {formatFullTimestamp(r.createdAt)}
                                </span>
                              </div>
                              <p className="text-xs text-gray-700">{r.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">No responses yet.</p>
                    )}

                    {replyingTo === entry.id ? (
                      <div className="space-y-2">
                        <textarea
                          rows={2}
                          autoFocus
                          placeholder="Write a response..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                        />
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleAddReply(entry)}
                            disabled={!replyText.trim()}
                            className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition"
                          >
                            Send Reply
                          </button>
                          <button
                            onClick={() => { setReplyingTo(null); setReplyText(''); }}
                            className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-xl transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setReplyingTo(entry.id)}
                        className="flex items-center space-x-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium hover:bg-blue-50 w-full px-2 py-1.5 rounded-xl transition"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Add Response</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  /* ================================================================
     MISC LIST VIEW
  ================================================================ */
  const renderMisc = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setActiveView('overview')}
            className="text-xs text-gray-500 hover:text-gray-700 font-medium inline-flex items-center space-x-1"
          >
            <ChevronRight className="w-3.5 h-3.5 rotate-180" />
            <span>Back</span>
          </button>
          <span className="text-sm font-bold text-gray-900 flex items-center space-x-2">
            <Tag className="w-4 h-4 text-indigo-600" />
            <span>Shift Notes & Misc ({filteredMisc.length})</span>
          </span>
        </div>
        <div className="flex items-center space-x-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 w-44"
            />
          </div>
          <select
            value={subCategoryFilter}
            onChange={(e) => setSubCategoryFilter(e.target.value)}
            className="px-2.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="All">All Subcategories</option>
            {miscSubcategories.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
          <button
            onClick={() => onOpenNewModal('Miscellaneous')}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Note</span>
          </button>
        </div>
      </div>

      {filteredMisc.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
          <List className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-semibold text-gray-500">No shift notes logged yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMisc.map((entry) => {
            const isExpanded = expandedCards.has(entry.id);
            return (
              <div key={entry.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-all">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 px-2.5 py-0.5 rounded-full">
                          {entry.category}
                        </span>
                        {entry.subCategory && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">{entry.subCategory}</span>
                        )}
                      </div>
                      <h4 className="text-base font-bold text-gray-900">{entry.topic}</h4>
                      {entry.clerkNotes && (
                        <p className="mt-1.5 text-xs text-gray-600 leading-relaxed">{entry.clerkNotes}</p>
                      )}
                      <div className="flex items-center space-x-3 mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                        <span className="flex items-center space-x-1"><User className="w-3 h-3" /><span>{entry.clerkName}</span></span>
                        <span className="flex items-center space-x-1 font-mono">
                          <Clock className="w-3 h-3 text-blue-500" />
                          <span>{formatFullTimestamp(entry.createdAt)}</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 flex-shrink-0">
                      <button onClick={() => onEditLog(entry)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {currentUser.role === 'manager' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (window.confirm('Delete this note? (Manager Action)')) onDeleteLog(entry.id);
                          }}
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete Note (Manager Only)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => toggleExpand(entry.id)}
                    className="mt-2 flex items-center space-x-1 text-[11px] text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <span>Responses</span>
                    {(entry.responses?.length || 0) > 0 && (
                      <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1">
                        {entry.responses!.length}
                      </span>
                    )}
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
                    {(entry.responses?.length || 0) > 0 ? (
                      <div className="space-y-2">
                        {entry.responses!.map((r) => (
                          <div key={r.id} className="flex items-start space-x-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                              r.authorRole === 'manager' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'
                            }`}>
                              {r.authorName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl p-2.5">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{r.authorName}</span>
                                <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
                                  {formatFullTimestamp(r.createdAt)}
                                </span>
                              </div>
                              <p className="text-xs text-gray-700">{r.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">No responses yet.</p>
                    )}

                    {replyingTo === entry.id ? (
                      <div className="space-y-2">
                        <textarea
                          rows={2}
                          autoFocus
                          placeholder="Write a response..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                        />
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleAddReply(entry)}
                            disabled={!replyText.trim()}
                            className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition"
                          >
                            Send Reply
                          </button>
                          <button
                            onClick={() => { setReplyingTo(null); setReplyText(''); }}
                            className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-xl transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setReplyingTo(entry.id)}
                        className="flex items-center space-x-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium hover:bg-indigo-50 w-full px-2 py-1.5 rounded-xl transition"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Add Response</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  /* ================================================================
     CUSTOM CATEGORY DETAIL VIEW
  ================================================================ */
  const renderCustomCategory = (cat: LogCategoryConfig) => {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setActiveView('overview')}
              className="text-xs text-gray-500 hover:text-gray-700 font-medium inline-flex items-center space-x-1"
            >
              <ChevronRight className="w-3.5 h-3.5 rotate-180" />
              <span>Back</span>
            </button>
            <span className="text-sm font-bold text-gray-900 flex items-center space-x-2">
              <Tag className="w-4 h-4 text-purple-600" />
              <span>{cat.name} ({filteredCustomCategoryLogs.length})</span>
            </span>
          </div>

          <div className="flex items-center space-x-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 w-44"
              />
            </div>
            {/* Subcategory Filter */}
            <select
              value={subCategoryFilter}
              onChange={(e) => setSubCategoryFilter(e.target.value)}
              className="px-2.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="All">All Subcategories</option>
              {cat.subcategories.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
            <button
              onClick={() => onOpenNewModal(cat.name)}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add {cat.name}</span>
            </button>
          </div>
        </div>

        {filteredCustomCategoryLogs.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <List className="w-10 h-10 mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-semibold text-gray-500">No {cat.name} entries logged yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCustomCategoryLogs.map((entry) => {
              const isExpanded = expandedCards.has(entry.id);
              return (
                <div key={entry.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-all">
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-xs font-bold text-gray-900">{entry.topic || 'Untitled'}</span>
                          {entry.subCategory && (
                            <span className="text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded">
                              {entry.subCategory}
                            </span>
                          )}
                        </div>
                        {entry.clerkNotes && (
                          <p className="text-xs text-gray-600 line-clamp-2 mt-1">{entry.clerkNotes}</p>
                        )}
                        <div className="flex items-center space-x-3 mt-2 text-[11px] text-gray-400">
                          <span>By {entry.clerkName}</span>
                          <span>•</span>
                          <span>{formatFullTimestamp(entry.createdAt)}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => onEditLog(entry)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {currentUser.role === 'manager' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              if (window.confirm('Delete this entry? (Manager Action)')) onDeleteLog(entry.id);
                            }}
                            className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                            title="Delete Entry (Manager Only)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {activeView === 'overview' && renderOverview()}
      {activeView === 'sales-kanban' && renderSalesKanban()}
      {activeView === 'complaints' && renderComplaints()}
      {activeView === 'misc' && renderMisc()}
      {activeCustomCategory && renderCustomCategory(activeCustomCategory)}
    </div>
  );
};
