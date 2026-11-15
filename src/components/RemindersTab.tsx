import React, { useState, useMemo } from 'react';
import { 
  Bell, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Check, 
  RotateCcw, 
  ExternalLink 
} from 'lucide-react';
import { ShiftLogEntry, UserAccount } from '../types';
import { DatabaseManager } from '../utils/database';
import { p2pSyncManager } from '../utils/p2pSyncManager';

interface RemindersTabProps {
  logs: ShiftLogEntry[];
  currentUser: UserAccount;
  onEditLog: (entry: ShiftLogEntry) => void;
  onRefresh: () => void;
}

const db = new DatabaseManager();

export const RemindersTab: React.FC<RemindersTabProps> = ({
  logs,
  onEditLog,
  onRefresh,
}) => {
  const [filter, setFilter] = useState<'pending' | 'completed' | 'all'>('pending');

  // Filter only entries that have reminders set
  const reminderEntries = useMemo(() => {
    return logs.filter((l) => l.hasReminder && l.reminderDate);
  }, [logs]);


  // Sort and categorize
  const { overdue, today, upcoming, completed } = useMemo(() => {
    const overdueList: ShiftLogEntry[] = [];
    const todayList: ShiftLogEntry[] = [];
    const upcomingList: ShiftLogEntry[] = [];
    const completedList: ShiftLogEntry[] = [];

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    reminderEntries.forEach((entry) => {
      if (entry.isReminderCompleted) {
        completedList.push(entry);
        return;
      }

      const due = new Date(entry.reminderDate!).getTime();
      if (due < startOfToday.getTime()) {
        overdueList.push(entry);
      } else if (due >= startOfToday.getTime() && due <= endOfToday.getTime()) {
        todayList.push(entry);
      } else {
        upcomingList.push(entry);
      }
    });

    // Sort by due date ascending
    const sortByDate = (a: ShiftLogEntry, b: ShiftLogEntry) =>
      new Date(a.reminderDate!).getTime() - new Date(b.reminderDate!).getTime();

    overdueList.sort(sortByDate);
    todayList.sort(sortByDate);
    upcomingList.sort(sortByDate);
    completedList.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());

    return {
      overdue: overdueList,
      today: todayList,
      upcoming: upcomingList,
      completed: completedList,
    };
  }, [reminderEntries]);

  const handleToggleComplete = async (entry: ShiftLogEntry) => {
    const updated: ShiftLogEntry = {
      ...entry,
      isReminderCompleted: !entry.isReminderCompleted,
      updatedAt: new Date().toISOString(),
    };
    await db.saveShiftLog(updated);
    p2pSyncManager.broadcastShiftLog(updated);
    onRefresh();
  };

  const renderReminderCard = (entry: ShiftLogEntry, statusBadge: 'overdue' | 'today' | 'upcoming' | 'completed') => {
    const isSales = entry.category === 'Sales';
    const isComplaint = entry.category === 'Complaint';

    return (
      <div
        key={entry.id}
        className={`p-4 rounded-2xl border transition-all duration-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          statusBadge === 'overdue'
            ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
            : statusBadge === 'today'
            ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50'
            : statusBadge === 'completed'
            ? 'bg-gray-50/60 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 opacity-75'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
        }`}
      >
        <div className="flex items-start space-x-3.5 flex-1">
          {/* Completion Checkbox */}
          <button
            onClick={() => handleToggleComplete(entry)}
            className={`mt-0.5 p-1 rounded-lg border transition ${
              entry.isReminderCompleted
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'border-gray-300 dark:border-gray-600 hover:border-blue-500 text-transparent hover:text-gray-400'
            }`}
          >
            <Check className="w-4 h-4" />
          </button>

          <div className="space-y-1.5 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Badge */}
              {statusBadge === 'overdue' && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 flex items-center space-x-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>OVERDUE</span>
                </span>
              )}
              {statusBadge === 'today' && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>DUE TODAY</span>
                </span>
              )}
              {statusBadge === 'upcoming' && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 flex items-center space-x-1">
                  <Calendar className="w-3 h-3" />
                  <span>UPCOMING</span>
                </span>
              )}
              {statusBadge === 'completed' && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>COMPLETED</span>
                </span>
              )}

              {/* Category Pill */}
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                  isSales
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                    : isComplaint
                    ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                    : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300'
                }`}
              >
                {entry.category} {entry.subCategory ? `• ${entry.subCategory}` : ''}
              </span>
            </div>

            {/* Title / Reminder Note */}
            <div>
              <h4 className={`text-sm font-bold text-gray-900 dark:text-white ${
                entry.isReminderCompleted ? 'line-through text-gray-500' : ''
              }`}>
                {entry.reminderNote || `Follow-up on ${entry.name || entry.topic}`}
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                Related to: <strong>{entry.name || entry.topic}</strong>
                {entry.phoneNumber ? ` • Tel: ${entry.phoneNumber}` : ''}
                {entry.roomNumber ? ` • Room: ${entry.roomNumber}` : ''}
              </p>
            </div>

            {/* Due Date & Time */}
            <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center space-x-1 font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  Due:{' '}
                  {new Date(entry.reminderDate!).toLocaleDateString([], {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </span>
              <span>•</span>
              <span>Clerk: {entry.clerkName}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 justify-end">
          <button
            onClick={() => onEditLog(entry)}
            className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-xl transition text-gray-700 dark:text-gray-200 shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Log</span>
          </button>
          <button
            onClick={() => handleToggleComplete(entry)}
            className={`flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold rounded-xl transition shadow-sm ${
              entry.isReminderCompleted
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {entry.isReminderCompleted ? (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reopen</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Done</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  const totalPending = overdue.length + today.length + upcoming.length;

  return (
    <div className="space-y-6">
      {/* Header and Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Front Desk Shift Reminders
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Shared task list & follow-ups across all shift clerks and registers
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setFilter('pending')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition ${
              filter === 'pending'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Pending ({totalPending})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition ${
              filter === 'completed'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Completed ({completed.length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition ${
              filter === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            All ({reminderEntries.length})
          </button>
        </div>
      </div>

      {reminderEntries.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center mb-3">
            <Bell className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
            No Active Reminders
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            When creating or editing a Sales Lead, Guest Complaint, or Shift Note, check the &quot;Set Reminder&quot; box to schedule follow-ups.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overdue Section */}
          {(filter === 'pending' || filter === 'all') && overdue.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-rose-700 dark:text-rose-400 font-bold text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>Overdue Action Items ({overdue.length})</span>
              </div>
              <div className="space-y-2.5">
                {overdue.map((entry) => renderReminderCard(entry, 'overdue'))}
              </div>
            </div>
          )}

          {/* Today Section */}
          {(filter === 'pending' || filter === 'all') && today.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-amber-700 dark:text-amber-400 font-bold text-sm">
                <Clock className="w-4 h-4" />
                <span>Due Today ({today.length})</span>
              </div>
              <div className="space-y-2.5">
                {today.map((entry) => renderReminderCard(entry, 'today'))}
              </div>
            </div>
          )}

          {/* Upcoming Section */}
          {(filter === 'pending' || filter === 'all') && upcoming.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-blue-700 dark:text-blue-400 font-bold text-sm">
                <Calendar className="w-4 h-4" />
                <span>Upcoming Scheduled Reminders ({upcoming.length})</span>
              </div>
              <div className="space-y-2.5">
                {upcoming.map((entry) => renderReminderCard(entry, 'upcoming'))}
              </div>
            </div>
          )}

          {/* Completed Section */}
          {(filter === 'completed' || filter === 'all') && completed.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>Completed Tasks ({completed.length})</span>
              </div>
              <div className="space-y-2.5">
                {completed.map((entry) => renderReminderCard(entry, 'completed'))}
              </div>
            </div>
          )}

          {filter === 'pending' && totalPending === 0 && (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                All caught up!
              </h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                There are no pending reminders for this shift. Great job!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
