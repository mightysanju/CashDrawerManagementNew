import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  DollarSign, 
  AlertTriangle, 
  Tag, 
  Search, 
  Plus, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Phone, 
  Mail, 
  User, 
  Bell, 
  Edit3, 
  Trash2 
} from 'lucide-react';
import { 
  ShiftLogEntry, 
  SalesLeadStatus, 
  ComplaintStatus, 
  UserAccount, 
  PrimaryCategory 
} from '../types';
import { DatabaseManager } from '../utils/database';
import { p2pSyncManager } from '../utils/p2pSyncManager';

interface ShiftLogDashboardProps {
  logs: ShiftLogEntry[];
  currentUser: UserAccount;
  onOpenNewModal: (category?: PrimaryCategory) => void;
  onEditLog: (entry: ShiftLogEntry) => void;
  onDeleteLog: (id: string) => void;
  onRefresh: () => void;
}

const db = new DatabaseManager();

export const ShiftLogDashboard: React.FC<ShiftLogDashboardProps> = ({
  logs,
  currentUser,
  onOpenNewModal,
  onEditLog,
  onDeleteLog,
  onRefresh,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<'All' | 'Sales' | 'Complaint' | 'Miscellaneous'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Compute Sales Card Metrics
  const salesMetrics = useMemo(() => {
    const salesLogs = logs.filter((l) => l.category === 'Sales');
    const leadCount = salesLogs.length;

    let totalPotentialRoomNights = 0;
    let totalPotentialRevenue = 0;
    let wonCount = 0;
    let lostCount = 0;
    let activeRevenue = 0;

    salesLogs.forEach((l) => {
      const roomNights = l.totalRoomNights || 0;
      const revenue = l.potentialRevenue || 0;

      totalPotentialRoomNights += roomNights;
      totalPotentialRevenue += revenue;

      if (l.salesStatus === 'Closed Definite') {
        wonCount += 1;
      } else if (l.salesStatus === 'Lost') {
        lostCount += 1;
      } else {
        // Active pipeline
        activeRevenue += revenue;
      }
    });

    return {
      leadCount,
      totalPotentialRoomNights,
      totalPotentialRevenue,
      wonCount,
      lostCount,
      activeRevenue,
    };
  }, [logs]);

  // Compute Complaints Metrics
  const complaintMetrics = useMemo(() => {
    const complaintLogs = logs.filter((l) => l.category === 'Complaint');
    const total = complaintLogs.length;
    const open = complaintLogs.filter((l) => l.complaintStatus === 'Open').length;
    const inProgress = complaintLogs.filter((l) => l.complaintStatus === 'In Progress').length;
    const resolved = complaintLogs.filter((l) => l.complaintStatus === 'Resolved').length;

    return { total, open, inProgress, resolved };
  }, [logs]);

  // Compute Misc Metrics
  const miscMetrics = useMemo(() => {
    const miscLogs = logs.filter((l) => l.category === 'Miscellaneous' || (l.category !== 'Sales' && l.category !== 'Complaint'));
    return {
      total: miscLogs.length,
    };
  }, [logs]);

  // Filter and search logs
  const filteredLogs = useMemo(() => {
    return logs.filter((entry) => {
      // Category filter
      if (selectedFilter !== 'All') {
        if (selectedFilter === 'Miscellaneous') {
          if (entry.category === 'Sales' || entry.category === 'Complaint') return false;
        } else if (entry.category !== selectedFilter) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'All') {
        if (entry.category === 'Sales' && entry.salesStatus !== statusFilter) return false;
        if (entry.category === 'Complaint' && entry.complaintStatus !== statusFilter) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = entry.name?.toLowerCase().includes(q);
        const matchPhone = entry.phoneNumber?.toLowerCase().includes(q);
        const matchEmail = entry.email?.toLowerCase().includes(q);
        const matchTopic = entry.topic?.toLowerCase().includes(q);
        const matchNotes = entry.clerkNotes?.toLowerCase().includes(q);
        const matchRoom = entry.roomNumber?.toLowerCase().includes(q);
        const matchRes = entry.reservationNumber?.toLowerCase().includes(q);
        const matchSub = entry.subCategory?.toLowerCase().includes(q);
        const matchClerk = entry.clerkName?.toLowerCase().includes(q);

        if (!matchName && !matchPhone && !matchEmail && !matchTopic && !matchNotes && !matchRoom && !matchRes && !matchSub && !matchClerk) {
          return false;
        }
      }

      return true;
    });
  }, [logs, selectedFilter, statusFilter, searchQuery]);

  // Inline status update
  const handleUpdateSalesStatus = async (entry: ShiftLogEntry, newStatus: SalesLeadStatus) => {
    const updated: ShiftLogEntry = {
      ...entry,
      salesStatus: newStatus,
      updatedAt: new Date().toISOString(),
    };
    await db.saveShiftLog(updated);
    p2pSyncManager.broadcastShiftLog(updated);
    onRefresh();
  };

  const handleUpdateComplaintStatus = async (entry: ShiftLogEntry, newStatus: ComplaintStatus) => {
    const updated: ShiftLogEntry = {
      ...entry,
      complaintStatus: newStatus,
      updatedAt: new Date().toISOString(),
    };
    await db.saveShiftLog(updated);
    p2pSyncManager.broadcastShiftLog(updated);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* -------------------- 3 TOP DASHBOARD CARDS -------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1. SALES & LEADS CARD */}
        <div
          onClick={() => {
            setSelectedFilter('Sales');
            setStatusFilter('All');
          }}
          className={`cursor-pointer rounded-2xl p-5 border transition-all duration-200 shadow-sm hover:shadow-md relative overflow-hidden flex flex-col justify-between ${
            selectedFilter === 'Sales'
              ? 'bg-gradient-to-br from-emerald-500 to-teal-700 text-white border-emerald-600 ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-gray-900'
              : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700 hover:border-emerald-500 dark:hover:border-emerald-500'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold uppercase tracking-wider ${
                selectedFilter === 'Sales' ? 'text-emerald-100' : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                Sales Leads & Groups
              </span>
              <div className={`p-2 rounded-xl ${
                selectedFilter === 'Sales' ? 'bg-white/20' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
              }`}>
                <Building2 className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold">{salesMetrics.leadCount}</span>
              <span className={`text-xs ${selectedFilter === 'Sales' ? 'text-emerald-100' : 'text-gray-500'}`}>
                Total Leads
              </span>
            </div>

            {/* Won and Lost stats */}
            <div className="mt-3 flex items-center space-x-3 text-xs">
              <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full font-semibold ${
                selectedFilter === 'Sales' ? 'bg-emerald-800/60 text-emerald-100' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300'
              }`}>
                <CheckCircle2 className="w-3 h-3" />
                <span>Won: {salesMetrics.wonCount}</span>
              </span>
              <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full font-semibold ${
                selectedFilter === 'Sales' ? 'bg-black/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}>
                <XCircle className="w-3 h-3" />
                <span>Lost: {salesMetrics.lostCount}</span>
              </span>
            </div>
          </div>

          {/* Bottom Row: Potential Room Nights & Potential Revenue */}
          <div className={`mt-5 pt-3 border-t flex items-center justify-between text-xs ${
            selectedFilter === 'Sales' ? 'border-emerald-400/40' : 'border-gray-100 dark:border-gray-700'
          }`}>
            <div>
              <span className={`block text-[11px] font-medium ${selectedFilter === 'Sales' ? 'text-emerald-100' : 'text-gray-500 dark:text-gray-400'}`}>
                Potential Room Nights
              </span>
              <span className="text-base font-bold">
                {salesMetrics.totalPotentialRoomNights}
              </span>
            </div>
            <div className="text-right">
              <span className={`block text-[11px] font-medium ${selectedFilter === 'Sales' ? 'text-emerald-100' : 'text-gray-500 dark:text-gray-400'}`}>
                Potential Revenue
              </span>
              <span className="text-base font-bold">
                ${salesMetrics.totalPotentialRevenue.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* 2. COMPLAINTS CARD */}
        <div
          onClick={() => {
            setSelectedFilter('Complaint');
            setStatusFilter('All');
          }}
          className={`cursor-pointer rounded-2xl p-5 border transition-all duration-200 shadow-sm hover:shadow-md relative overflow-hidden flex flex-col justify-between ${
            selectedFilter === 'Complaint'
              ? 'bg-gradient-to-br from-rose-500 to-red-700 text-white border-rose-600 ring-2 ring-rose-500 ring-offset-2 dark:ring-offset-gray-900'
              : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700 hover:border-rose-500 dark:hover:border-rose-500'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold uppercase tracking-wider ${
                selectedFilter === 'Complaint' ? 'text-rose-100' : 'text-rose-600 dark:text-rose-400'
              }`}>
                Guest Complaints
              </span>
              <div className={`p-2 rounded-xl ${
                selectedFilter === 'Complaint' ? 'bg-white/20' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600'
              }`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold">{complaintMetrics.total}</span>
              <span className={`text-xs ${selectedFilter === 'Complaint' ? 'text-rose-100' : 'text-gray-500'}`}>
                Reported
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className={`px-2 py-0.5 rounded-full font-semibold ${
                selectedFilter === 'Complaint' ? 'bg-rose-800/60 text-white' : 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
              }`}>
                Open: {complaintMetrics.open}
              </span>
              <span className={`px-2 py-0.5 rounded-full font-semibold ${
                selectedFilter === 'Complaint' ? 'bg-black/20 text-white' : 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300'
              }`}>
                In Progress: {complaintMetrics.inProgress}
              </span>
              <span className={`px-2 py-0.5 rounded-full font-semibold ${
                selectedFilter === 'Complaint' ? 'bg-white/20 text-white' : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
              }`}>
                Resolved: {complaintMetrics.resolved}
              </span>
            </div>
          </div>

          <div className={`mt-5 pt-3 border-t flex items-center justify-between text-xs ${
            selectedFilter === 'Complaint' ? 'border-rose-400/40' : 'border-gray-100 dark:border-gray-700'
          }`}>
            <span className={selectedFilter === 'Complaint' ? 'text-rose-100' : 'text-gray-500 dark:text-gray-400'}>
              Service recovery rate
            </span>
            <span className="font-bold">
              {complaintMetrics.total > 0
                ? `${Math.round((complaintMetrics.resolved / complaintMetrics.total) * 100)}%`
                : '100%'}
            </span>
          </div>
        </div>

        {/* 3. MISCELLANEOUS CARD */}
        <div
          onClick={() => {
            setSelectedFilter('Miscellaneous');
            setStatusFilter('All');
          }}
          className={`cursor-pointer rounded-2xl p-5 border transition-all duration-200 shadow-sm hover:shadow-md relative overflow-hidden flex flex-col justify-between ${
            selectedFilter === 'Miscellaneous'
              ? 'bg-gradient-to-br from-indigo-500 to-purple-700 text-white border-indigo-600 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-gray-900'
              : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold uppercase tracking-wider ${
                selectedFilter === 'Miscellaneous' ? 'text-indigo-100' : 'text-indigo-600 dark:text-indigo-400'
              }`}>
                Shift Notes & Misc
              </span>
              <div className={`p-2 rounded-xl ${
                selectedFilter === 'Miscellaneous' ? 'bg-white/20' : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600'
              }`}>
                <Tag className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold">{miscMetrics.total}</span>
              <span className={`text-xs ${selectedFilter === 'Miscellaneous' ? 'text-indigo-100' : 'text-gray-500'}`}>
                Logged Entries
              </span>
            </div>

            <p className={`mt-3 text-xs line-clamp-2 ${
              selectedFilter === 'Miscellaneous' ? 'text-indigo-100' : 'text-gray-500 dark:text-gray-400'
            }`}>
              Front desk shift handovers, operational updates, maintenance logs, and courier drops.
            </p>
          </div>

          <div className={`mt-5 pt-3 border-t flex items-center justify-between text-xs ${
            selectedFilter === 'Miscellaneous' ? 'border-indigo-400/40' : 'border-gray-100 dark:border-gray-700'
          }`}>
            <span className={selectedFilter === 'Miscellaneous' ? 'text-indigo-100' : 'text-gray-500 dark:text-gray-400'}>
              Handover status
            </span>
            <span className="font-bold">Active</span>
          </div>
        </div>
      </div>

      {/* -------------------- CONTROLS & FILTER BAR -------------------- */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {(['All', 'Sales', 'Complaint', 'Miscellaneous'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedFilter(cat);
                setStatusFilter('All');
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                selectedFilter === cat
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {cat === 'All' ? 'All Logs' : cat === 'Sales' ? 'Sales Leads' : cat === 'Complaint' ? 'Complaints' : 'Shift Notes'}
            </button>
          ))}
        </div>

        {/* Search and Action Buttons */}
        <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
          {/* Status Sub-Filter */}
          {selectedFilter === 'Sales' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="New Lead">New Lead</option>
              <option value="Processing">Processing</option>
              <option value="Tentative / Contract Sent">Tentative / Contract Sent</option>
              <option value="Closed Definite">Closed Definite (Won)</option>
              <option value="Lost">Lost</option>
            </select>
          )}

          {selectedFilter === 'Complaint' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
            </select>
          )}

          {/* Search Input */}
          <div className="relative flex-1 md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              placeholder="Search leads, names, rooms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
            />
          </div>

          {/* Add Log Button */}
          <button
            onClick={() => onOpenNewModal(selectedFilter === 'All' ? 'Sales' : selectedFilter)}
            className="flex items-center space-x-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-semibold shadow-sm transition whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Add Log</span>
          </button>
        </div>
      </div>

      {/* -------------------- LOGS LIST / TABLE -------------------- */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
            No Shift Logs Found
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-4">
            {searchQuery
              ? 'No entries match your search criteria. Try a different search keyword.'
              : 'Start logging sales group leads, guest complaints, or shift notes to track front desk operations.'}
          </p>
          <button
            onClick={() => onOpenNewModal('Sales')}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Shift Log</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((entry) => {
            const isSales = entry.category === 'Sales';
            const isComplaint = entry.category === 'Complaint';

            return (
              <div
                key={entry.id}
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow transition-all duration-200"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  {/* Left Column: Category & Details */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Category Badge */}
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-1 ${
                          isSales
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            : isComplaint
                            ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                            : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300'
                        }`}
                      >
                        {isSales && <DollarSign className="w-3 h-3" />}
                        {isComplaint && <AlertTriangle className="w-3 h-3" />}
                        {!isSales && !isComplaint && <Tag className="w-3 h-3" />}
                        <span>{entry.category}</span>
                      </span>

                      {/* Subcategory */}
                      {entry.subCategory && (
                        <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-md font-medium">
                          {entry.subCategory}
                        </span>
                      )}

                      {/* Reminder Badge */}
                      {entry.hasReminder && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center space-x-1 ${
                            entry.isReminderCompleted
                              ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 line-through'
                              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 animate-pulse'
                          }`}
                        >
                          <Bell className="w-3 h-3" />
                          <span>
                            {entry.reminderDate
                              ? `Reminder: ${new Date(entry.reminderDate).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                              : 'Reminder set'}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Entry Name / Headline */}
                    <div className="flex items-center space-x-2">
                      <h4 className="text-base font-bold text-gray-900 dark:text-white">
                        {isSales || isComplaint ? entry.name : entry.topic}
                      </h4>
                      {isSales && entry.roomRequirement && (
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                          {entry.roomRequirement} Rooms
                        </span>
                      )}
                    </div>

                    {/* Contact & Context Information */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
                      {entry.phoneNumber && (
                        <span className="flex items-center space-x-1">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          <span>{entry.phoneNumber}</span>
                        </span>
                      )}
                      {entry.email && (
                        <span className="flex items-center space-x-1">
                          <Mail className="w-3.5 h-3.5 text-gray-400" />
                          <span>{entry.email}</span>
                        </span>
                      )}
                      {isComplaint && entry.roomNumber && (
                        <span className="font-semibold text-rose-700 dark:text-rose-400">
                          Room #{entry.roomNumber}
                        </span>
                      )}
                      {isComplaint && entry.reservationNumber && (
                        <span>Res: {entry.reservationNumber}</span>
                      )}
                      {isSales && entry.checkInDate && entry.checkOutDate && (
                        <span className="flex items-center space-x-1 text-gray-700 dark:text-gray-300 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                          <span>
                            {entry.checkInDate} to {entry.checkOutDate}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Clerk Notes */}
                    {entry.clerkNotes && (
                      <p className="text-xs bg-gray-50 dark:bg-gray-700/40 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                        {entry.clerkNotes}
                      </p>
                    )}

                    {/* Author & Timestamp */}
                    <div className="flex items-center space-x-3 text-[11px] text-gray-400 pt-1">
                      <span className="flex items-center space-x-1">
                        <User className="w-3 h-3" />
                        <span>Clerk: {entry.clerkName}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(entry.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </span>
                      {entry.drawerNumber && (
                        <>
                          <span>•</span>
                          <span>Drawer #{entry.drawerNumber}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Numbers and Status Pipeline */}
                  <div className="flex flex-col items-end space-y-2.5 min-w-[180px]">
                    {/* Potential Revenue & Nights Box for Sales */}
                    {isSales && (
                      <div className="text-right bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl px-3 py-2 w-full">
                        <div className="flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                          <span className="font-medium">Room Nights:</span>
                          <span className="font-bold">{entry.totalRoomNights || 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-200 font-bold mt-0.5">
                          <span>Est. Revenue:</span>
                          <span className="text-emerald-700 dark:text-emerald-400 font-extrabold text-sm">
                            ${(entry.potentialRevenue || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Interactive Status Selector Dropdown */}
                    {isSales && (
                      <div className="w-full">
                        <label className="block text-[10px] text-gray-400 uppercase font-semibold mb-0.5 text-right">
                          Pipeline Status
                        </label>
                        <select
                          value={entry.salesStatus || 'New Lead'}
                          onChange={(e) => handleUpdateSalesStatus(entry, e.target.value as SalesLeadStatus)}
                          className={`w-full text-xs font-bold py-1.5 px-2.5 rounded-xl border focus:outline-none focus:ring-2 transition ${
                            entry.salesStatus === 'Closed Definite'
                              ? 'bg-emerald-600 text-white border-emerald-600 focus:ring-emerald-500'
                              : entry.salesStatus === 'Lost'
                              ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                              : entry.salesStatus === 'Tentative / Contract Sent'
                              ? 'bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-700'
                              : 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700'
                          }`}
                        >
                          <option value="New Lead">New Lead</option>
                          <option value="Processing">Processing</option>
                          <option value="Tentative / Contract Sent">Tentative / Contract Sent</option>
                          <option value="Closed Definite">Closed Definite (Won)</option>
                          <option value="Lost">Lost</option>
                        </select>
                      </div>
                    )}

                    {isComplaint && (
                      <div className="w-full">
                        <label className="block text-[10px] text-gray-400 uppercase font-semibold mb-0.5 text-right">
                          Resolution Status
                        </label>
                        <select
                          value={entry.complaintStatus || 'Open'}
                          onChange={(e) => handleUpdateComplaintStatus(entry, e.target.value as ComplaintStatus)}
                          className={`w-full text-xs font-bold py-1.5 px-2.5 rounded-xl border focus:outline-none focus:ring-2 transition ${
                            entry.complaintStatus === 'Resolved'
                              ? 'bg-emerald-600 text-white border-emerald-600 focus:ring-emerald-500'
                              : entry.complaintStatus === 'In Progress'
                              ? 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                        </select>
                      </div>
                    )}

                    {/* Edit and Delete Actions */}
                    <div className="flex items-center justify-end space-x-2 pt-1 w-full">
                      <button
                        onClick={() => onEditLog(entry)}
                        title="Edit Entry"
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {(currentUser.role === 'manager' || currentUser.id === entry.clerkId) && (
                        <button
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this shift log entry?')) {
                              onDeleteLog(entry.id);
                            }
                          }}
                          title="Delete Entry"
                          className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
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
