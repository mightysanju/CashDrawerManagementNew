import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import {
  ShiftLogEntry,
  ComplaintStatus,
  UserAccount,
  PrimaryCategory,
} from '../types';
import { DatabaseManager } from '../utils/database';
import { p2pSyncManager } from '../utils/p2pSyncManager';
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

type ActiveView = 'overview' | 'sales-kanban' | 'complaints' | 'misc';

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
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  /* ----- Metrics ----- */
  const salesMetrics = useMemo(() => {
    const sl = logs.filter((l) => l.category === 'Sales');
    let totalRoomNights = 0, totalRevenue = 0, wonCount = 0, lostCount = 0;
    sl.forEach((l) => {
      totalRoomNights += l.totalRoomNights || 0;
      totalRevenue += l.potentialRevenue || 0;
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
    total: logs.filter((l) => l.category !== 'Sales' && l.category !== 'Complaint').length,
  }), [logs]);

  /* ----- Filtered lists ----- */
  const salesLeads = useMemo(() => logs.filter((l) => l.category === 'Sales'), [logs]);

  const filteredComplaints = useMemo(() => {
    return logs.filter((l) => {
      if (l.category !== 'Complaint') return false;
      if (statusFilter !== 'All' && l.complaintStatus !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          l.name?.toLowerCase().includes(q) ||
          l.phoneNumber?.toLowerCase().includes(q) ||
          l.roomNumber?.toLowerCase().includes(q) ||
          l.reservationNumber?.toLowerCase().includes(q) ||
          l.clerkNotes?.toLowerCase().includes(q) ||
          false
        );
      }
      return true;
    });
  }, [logs, statusFilter, searchQuery]);

  const filteredMisc = useMemo(() => {
    return logs.filter((l) => {
      if (l.category === 'Sales' || l.category === 'Complaint') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return l.topic?.toLowerCase().includes(q) || l.clerkNotes?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [logs, searchQuery]);

  /* ----- Actions ----- */
  const handleUpdateComplaintStatus = async (entry: ShiftLogEntry, status: ComplaintStatus) => {
    const updated = { ...entry, complaintStatus: status, updatedAt: new Date().toISOString() };
    await db.saveShiftLog(updated);
    p2pSyncManager.broadcastShiftLog(updated);
    onRefresh();
  };

  const handleAddReply = async (entry: ShiftLogEntry) => {
    if (!replyText.trim()) return;
    const newResp = {
      id: `resp_${Date.now()}`,
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

      {/* 3 Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* SALES CARD */}
        <button
          onClick={() => setActiveView('sales-kanban')}
          className="text-left w-full group bg-white border border-gray-200 hover:border-blue-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-emerald-700" />
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

        {/* COMPLAINTS CARD */}
        <button
          onClick={() => setActiveView('complaints')}
          className="text-left w-full group bg-white border border-gray-200 hover:border-rose-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-rose-700" />
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

        {/* MISC CARD */}
        <button
          onClick={() => setActiveView('misc')}
          className="text-left w-full group bg-white border border-gray-200 hover:border-indigo-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <Tag className="w-4 h-4 text-indigo-700" />
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
      </div>

      {/* Recent activity — last 5 logs */}
      {logs.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Recent Activity</h3>
          <div className="space-y-2">
            {logs.slice(0, 5).map((entry) => (
              <div key={entry.id} className="flex items-center space-x-3 bg-white border border-gray-100 rounded-xl px-4 py-2.5 shadow-sm hover:shadow-md transition">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  entry.category === 'Sales' ? 'bg-emerald-500' :
                  entry.category === 'Complaint' ? 'bg-rose-500' : 'bg-indigo-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {entry.name || entry.topic || 'Shift Note'}
                  </p>
                  <p className="text-xs text-gray-400">{entry.clerkName} · {entry.category}</p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {new Date(entry.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  /* ================================================================
     SALES KANBAN VIEW
  ================================================================ */
  const renderSalesKanban = () => (
    <div>
      <div className="flex items-center space-x-3 mb-5">
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
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-400 w-48"
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
                          entry.complaintStatus === 'Resolved' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                          entry.complaintStatus === 'In Progress' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                          'bg-amber-50 border-amber-200 text-amber-700'
                        }`}>
                          {entry.complaintStatus || 'Open'}
                        </span>
                        {entry.roomNumber && (
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md font-medium">
                            Room {entry.roomNumber}
                          </span>
                        )}
                        {entry.hasReminder && !entry.isReminderCompleted && (
                          <Bell className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                        )}
                      </div>
                      <h4 className="text-base font-bold text-gray-900">{entry.name}</h4>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                        {entry.phoneNumber && (
                          <span className="flex items-center space-x-1"><Phone className="w-3.5 h-3.5" /><span>{entry.phoneNumber}</span></span>
                        )}
                        {entry.reservationNumber && <span>Res: {entry.reservationNumber}</span>}
                      </div>
                      {entry.clerkNotes && (
                        <p className="mt-2 text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 leading-relaxed">{entry.clerkNotes}</p>
                      )}
                      <div className="flex items-center space-x-3 mt-2 text-[11px] text-gray-400">
                        <span className="flex items-center space-x-1"><User className="w-3 h-3" /><span>{entry.clerkName}</span></span>
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(entry.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </span>
                      </div>
                    </div>

                    {/* Right: status selector + actions */}
                    <div className="flex flex-col items-end space-y-2 flex-shrink-0">
                      <select
                        value={entry.complaintStatus || 'Open'}
                        onChange={(e) => handleUpdateComplaintStatus(entry, e.target.value as ComplaintStatus)}
                        className={`text-xs font-bold py-1.5 px-2 rounded-xl border focus:outline-none focus:ring-2 transition cursor-pointer ${
                          entry.complaintStatus === 'Resolved' ? 'bg-emerald-600 text-white border-emerald-600' :
                          entry.complaintStatus === 'In Progress' ? 'bg-blue-100 text-blue-900 border-blue-300' :
                          'bg-amber-100 text-amber-900 border-amber-300'
                        }`}
                      >
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                      <div className="flex items-center space-x-1">
                        <button onClick={() => onEditLog(entry)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {(currentUser.role === 'manager' || currentUser.id === entry.clerkId) && (
                          <button
                            onClick={() => { if (window.confirm('Delete this complaint?')) onDeleteLog(entry.id); }}
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

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
                                <span className="text-xs font-bold text-gray-700">{r.authorName}</span>
                                <span className="text-[9px] text-gray-400">
                                  {new Date(r.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
      <div className="flex items-center justify-between">
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
        <button
          onClick={() => onOpenNewModal('Miscellaneous')}
          className="inline-flex items-center space-x-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Note</span>
        </button>
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
                      <div className="flex items-center space-x-3 mt-2 text-[11px] text-gray-400">
                        <span className="flex items-center space-x-1"><User className="w-3 h-3" /><span>{entry.clerkName}</span></span>
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(entry.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 flex-shrink-0">
                      <button onClick={() => onEditLog(entry)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {(currentUser.role === 'manager' || currentUser.id === entry.clerkId) && (
                        <button
                          onClick={() => { if (window.confirm('Delete this note?')) onDeleteLog(entry.id); }}
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
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
                                <span className="text-xs font-bold text-gray-700">{r.authorName}</span>
                                <span className="text-[9px] text-gray-400">
                                  {new Date(r.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
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

  return (
    <div>
      {activeView === 'overview' && renderOverview()}
      {activeView === 'sales-kanban' && renderSalesKanban()}
      {activeView === 'complaints' && renderComplaints()}
      {activeView === 'misc' && renderMisc()}
    </div>
  );
};
