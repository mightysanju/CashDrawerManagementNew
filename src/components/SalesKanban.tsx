import React, { useState } from 'react';
import {
  Building2,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Plus,
  Edit3,
  Trash2,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  User,
  Clock,
  GripVertical,
} from 'lucide-react';
import { ShiftLogEntry, SalesLeadStatus, UserAccount, RoomBookingItem } from '../types';
import { DatabaseManager } from '../utils/database';
import { p2pSyncManager } from '../utils/p2pSyncManager';
import { formatFullTimestamp } from '../utils/dateUtils';
import { Trophy, CheckCircle2, X } from 'lucide-react';

interface SalesKanbanProps {
  leads: ShiftLogEntry[];
  currentUser: UserAccount;
  onOpenNewModal: () => void;
  onEditLead: (entry: ShiftLogEntry) => void;
  onDeleteLead: (id: string) => void;
  onRefresh: () => void;
}

const db = new DatabaseManager();

const COLUMNS: { id: SalesLeadStatus; label: string; color: string; bg: string; border: string; dot: string }[] = [
  {
    id: 'New Lead',
    label: '1. New Leads',
    color: 'text-blue-700',
    bg: 'bg-blue-50/70',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  {
    id: 'Processing',
    label: '2. Processing',
    color: 'text-amber-700',
    bg: 'bg-amber-50/70',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  {
    id: 'Closed Definite',
    label: '3. Closed Definite',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50/70',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  {
    id: 'Lost',
    label: '4. Lost',
    color: 'text-gray-500',
    bg: 'bg-gray-50/80',
    border: 'border-gray-200',
    dot: 'bg-gray-400',
  },
];

export const SalesKanban: React.FC<SalesKanbanProps> = ({
  leads,
  currentUser,
  onOpenNewModal,
  onEditLead,
  onDeleteLead,
  onRefresh,
}) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<SalesLeadStatus | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Closed Definite multi-row room rate modal state
  const [closingDefiniteLead, setClosingDefiniteLead] = useState<ShiftLogEntry | null>(null);
  const [bookingNights, setBookingNights] = useState<number>(1);
  const [bookingRows, setBookingRows] = useState<RoomBookingItem[]>([]);

  const getLeadsForCol = (colId: SalesLeadStatus) => {
    if (colId === 'Processing') {
      return leads.filter(
        (l) => (l.salesStatus || 'New Lead') === 'Processing' || l.salesStatus === 'Tentative / Contract Sent'
      );
    }
    return leads.filter((l) => (l.salesStatus || 'New Lead') === colId);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, colId: SalesLeadStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(colId);
  };

  const handleDrop = async (e: React.DragEvent, colId: SalesLeadStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedId;
    if (!id) return;

    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.salesStatus === colId) {
      setDraggedId(null);
      setDragOverCol(null);
      return;
    }

    // When moving to Closed Definite, prompt for Offered Rate, Room Type, Room Count (multi-row)
    if (colId === 'Closed Definite') {
      const start = lead.checkInDate ? new Date(lead.checkInDate).getTime() : 0;
      const end = lead.checkOutDate ? new Date(lead.checkOutDate).getTime() : 0;
      const calcNights = (start && end && end > start) ? Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24))) : 1;
      setBookingNights(calcNights);
      setBookingRows(
        lead.roomBookings && lead.roomBookings.length > 0
          ? lead.roomBookings
          : [
              {
                id: '1',
                roomType: 'Standard King',
                roomCount: lead.roomRequirement || 5,
                offeredRate: 119,
              },
            ]
      );
      setClosingDefiniteLead(lead);
      setDraggedId(null);
      setDragOverCol(null);
      return;
    }

    const updated: ShiftLogEntry = {
      ...lead,
      salesStatus: colId,
      updatedAt: new Date().toISOString(),
    };

    await db.saveShiftLog(updated);
    p2pSyncManager.broadcastShiftLog(updated);
    setDraggedId(null);
    setDragOverCol(null);
    onRefresh();
  };

  const handleConfirmClosedDefinite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingDefiniteLead) return;

    const nights = Math.max(1, bookingNights || 1);
    const validRows = bookingRows.filter((r) => r.roomCount > 0 && r.offeredRate > 0);
    if (validRows.length === 0) {
      alert('Please specify at least one room booking row with quantity and offered rate.');
      return;
    }

    const totalRooms = validRows.reduce((sum, r) => sum + r.roomCount, 0);
    const totalRoomNights = totalRooms * nights;
    const actualRevenue = validRows.reduce((sum, r) => sum + (r.roomCount * nights * r.offeredRate), 0);

    const updated: ShiftLogEntry = {
      ...closingDefiniteLead,
      salesStatus: 'Closed Definite',
      roomRequirement: totalRooms,
      totalRoomNights,
      potentialRevenue: actualRevenue,
      actualClosedRevenue: actualRevenue,
      roomBookings: validRows,
      updatedAt: new Date().toISOString(),
    };

    await db.saveShiftLog(updated);
    p2pSyncManager.broadcastShiftLog(updated);
    setClosingDefiniteLead(null);
    onRefresh();
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverCol(null);
  };

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddReply = async (lead: ShiftLogEntry) => {
    if (!replyText.trim()) return;

    const newResponse = {
      id: `resp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      authorId: currentUser.id,
      authorName: currentUser.fullName,
      authorRole: currentUser.role,
      message: replyText.trim(),
      createdAt: new Date().toISOString(),
    };

    const updated: ShiftLogEntry = {
      ...lead,
      responses: [...(lead.responses || []), newResponse],
      updatedAt: new Date().toISOString(),
    };

    await db.saveShiftLog(updated);
    p2pSyncManager.broadcastShiftLog(updated);
    setReplyText('');
    setReplyingTo(null);
    onRefresh();
  };

  const totalRevenue = leads
    .filter((l) => l.salesStatus === 'Closed Definite')
    .reduce((s, l) => s + (l.potentialRevenue || 0), 0);

  const pipelineRevenue = leads
    .filter((l) => l.salesStatus !== 'Lost' && l.salesStatus !== 'Closed Definite')
    .reduce((s, l) => s + (l.potentialRevenue || 0), 0);

  return (
    <div className="space-y-5">
      {/* Pipeline Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Leads</p>
          <p className="text-2xl font-extrabold text-gray-900">{leads.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Pipeline Value</p>
          <p className="text-2xl font-extrabold text-blue-700">${pipelineRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-emerald-200 rounded-xl px-4 py-3 bg-emerald-50/60">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1">Closed Revenue</p>
          <p className="text-2xl font-extrabold text-emerald-700">${totalRevenue.toLocaleString()}</p>
        </div>
        <div className="flex items-center justify-center">
          <button
            onClick={onOpenNewModal}
            className="w-full h-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-bold text-sm shadow-sm shadow-blue-500/30 hover:shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* 4-Column Responsive Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5 items-start">
        {COLUMNS.map((col) => {
          const colLeads = getLeadsForCol(col.id);
          const isOver = dragOverCol === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
              onDragLeave={() => setDragOverCol(null)}
              className={`rounded-xl border transition-all duration-150 ${col.bg} ${col.border} ${
                isOver ? 'ring-2 ring-blue-500 ring-offset-1 bg-white' : ''
              }`}
            >
              {/* Column Header */}
              <div className={`px-3 py-3 border-b ${col.border} flex items-center justify-between`}>
                <div className="flex items-center space-x-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${col.dot} flex-shrink-0`} />
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${col.color}`}>
                    {col.label}
                  </h3>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white/70 border ${col.border} ${col.color}`}>
                  {colLeads.length}
                </span>
              </div>

              {/* Cards */}
              <div className="p-2.5 space-y-2.5 min-h-[200px]">
                {colLeads.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center opacity-40">
                    <Building2 className={`w-7 h-7 mb-2 ${col.color}`} />
                    <p className="text-xs text-gray-500">Drop leads here</p>
                  </div>
                )}

                {colLeads.map((lead) => {
                  const isExpanded = expandedCards.has(lead.id);
                  const isDragging = draggedId === lead.id;

                  return (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead.id)}
                      onDragEnd={handleDragEnd}
                      className={`bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-150 cursor-grab active:cursor-grabbing ${
                        isDragging ? 'opacity-40 scale-95' : 'opacity-100'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start space-x-2 flex-1 min-w-0">
                            <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-gray-900 truncate">{lead.name}</p>
                              {lead.subCategory && (
                                <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-md mt-0.5">
                                  {lead.subCategory}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-1 flex-shrink-0">
                            <button
                              onClick={() => onEditLead(lead)}
                              className="p-1 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {currentUser.role === 'manager' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  if (window.confirm('Delete this lead?')) onDeleteLead(lead.id);
                                }}
                                className="p-1 text-gray-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Revenue Pill */}
                        {(lead.potentialRevenue || 0) > 0 && (
                          <div className="mt-2 flex items-center justify-between text-xs">
                            <span className="flex items-center space-x-1 text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                              <DollarSign className="w-3 h-3" />
                              <span>${(lead.potentialRevenue || 0).toLocaleString()}</span>
                            </span>
                            {lead.totalRoomNights && (
                              <span className="text-gray-400">
                                {lead.totalRoomNights} room-nights
                              </span>
                            )}
                          </div>
                        )}

                        {/* Closed Definite Multi-Row Breakdown Preview */}
                        {lead.salesStatus === 'Closed Definite' && lead.roomBookings && lead.roomBookings.length > 0 && (
                          <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs space-y-1">
                            <div className="flex items-center justify-between font-bold text-emerald-800 dark:text-emerald-300">
                              <span className="flex items-center space-x-1">
                                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                                <span>Actual: ${(lead.actualClosedRevenue || lead.potentialRevenue || 0).toLocaleString()}</span>
                              </span>
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">{lead.totalRoomNights} room-nights</span>
                            </div>
                            <div className="space-y-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                              {lead.roomBookings.map((b, idx) => (
                                <div key={b.id || idx} className="flex justify-between">
                                  <span>{b.roomCount}x {b.roomType}</span>
                                  <span className="font-semibold">${b.offeredRate}/nt</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Dates */}
                        {lead.checkInDate && (
                          <div className="mt-1.5 flex items-center space-x-1 text-[11px] text-gray-500">
                            <Calendar className="w-3 h-3" />
                            <span>{lead.checkInDate} → {lead.checkOutDate}</span>
                          </div>
                        )}

                        {/* Expand toggle */}
                        <button
                          onClick={() => toggleExpand(lead.id)}
                          className="mt-2 flex items-center space-x-1 text-[11px] text-blue-600 hover:text-blue-700 font-medium"
                        >
                          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          <span>{isExpanded ? 'Less' : 'Details & Replies'}</span>
                          {(lead.responses?.length || 0) > 0 && (
                            <span className="ml-1 bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                              {lead.responses!.length}
                            </span>
                          )}
                        </button>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 px-3 pb-3 pt-2 space-y-3">
                          {/* Contact Info */}
                          <div className="space-y-1">
                            {lead.phoneNumber && (
                              <div className="flex items-center space-x-1.5 text-xs text-gray-600">
                                <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <span>{lead.phoneNumber}</span>
                              </div>
                            )}
                            {lead.email && (
                              <div className="flex items-center space-x-1.5 text-xs text-gray-600">
                                <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <span className="truncate">{lead.email}</span>
                              </div>
                            )}
                            {lead.roomRequirement && (
                              <div className="flex items-center space-x-1.5 text-xs text-gray-600">
                                <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <span>{lead.roomRequirement} rooms required</span>
                              </div>
                            )}
                          </div>

                          {/* Clerk Notes */}
                          {lead.clerkNotes && (
                            <div className="bg-gray-50 border border-gray-100 rounded-lg p-2 text-xs text-gray-700 leading-relaxed">
                              {lead.clerkNotes}
                            </div>
                          )}

                          {/* Author & Date */}
                          <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
                            <span className="flex items-center space-x-1">
                              <User className="w-3 h-3" />
                              <span>{lead.clerkName}</span>
                            </span>
                            <span className="flex items-center space-x-1 font-mono">
                              <Clock className="w-3 h-3 text-blue-500" />
                              <span>{formatFullTimestamp(lead.createdAt)}</span>
                            </span>
                          </div>

                          {/* Threaded Responses */}
                          {(lead.responses?.length || 0) > 0 && (
                            <div className="border-t border-gray-100 dark:border-gray-800 pt-2 space-y-2">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Responses & Actions</p>
                              {lead.responses!.map((r) => (
                                <div key={r.id} className="flex items-start space-x-2">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                                    r.authorRole === 'manager'
                                      ? 'bg-purple-100 text-purple-700'
                                      : 'bg-blue-100 text-blue-700'
                                  }`}>
                                    {r.authorName.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-2">
                                    <div className="flex items-center justify-between mb-0.5">
                                      <span className="text-[10px] font-bold text-gray-700 dark:text-gray-200">{r.authorName}</span>
                                      <span className="text-[9px] font-mono text-gray-500 dark:text-gray-400">
                                        {formatFullTimestamp(r.createdAt)}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-700 dark:text-gray-300">{r.message}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Reply Input */}
                          {replyingTo === lead.id ? (
                            <div className="space-y-1.5">
                              <textarea
                                rows={2}
                                autoFocus
                                placeholder="Write a response..."
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                className="w-full px-2.5 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                              />
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleAddReply(lead)}
                                  disabled={!replyText.trim()}
                                  className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition"
                                >
                                  Send Reply
                                </button>
                                <button
                                  onClick={() => { setReplyingTo(null); setReplyText(''); }}
                                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setReplyingTo(lead.id)}
                              className="flex items-center space-x-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium hover:bg-blue-50 w-full px-2 py-1.5 rounded-lg transition"
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
            </div>
          );
        })}
      </div>
      {/* Closed Definite Room Breakdown & Rate Modal */}
      {closingDefiniteLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 dark:border-gray-700 flex flex-col">
            <div className="bg-emerald-700 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-800 rounded-xl">
                  <Trophy className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Close Definite — Confirm Room Rates</h3>
                  <p className="text-[11px] text-emerald-100 truncate max-w-xs">{closingDefiniteLead.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setClosingDefiniteLead(null)}
                className="text-emerald-200 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmClosedDefinite} className="p-5 space-y-4 text-xs">
              {/* Stay Duration / Nights */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-200 dark:border-gray-600">
                <div>
                  <span className="font-semibold text-gray-700 dark:text-gray-300 block">Number of Nights</span>
                  <span className="text-[11px] text-gray-400">
                    {closingDefiniteLead.checkInDate && closingDefiniteLead.checkOutDate
                      ? `${closingDefiniteLead.checkInDate} to ${closingDefiniteLead.checkOutDate}`
                      : 'Calculated length of stay'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min={1}
                    required
                    value={bookingNights}
                    onChange={(e) => setBookingNights(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 px-2.5 py-1.5 text-center font-bold text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                  <span className="text-gray-500 font-medium">night{bookingNights === 1 ? '' : 's'}</span>
                </div>
              </div>

              {/* Multi-Row Room Booking Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wider text-[11px] text-gray-600 dark:text-gray-400">
                    Room Types & Offered Rates
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setBookingRows([
                        ...bookingRows,
                        {
                          id: Date.now().toString(),
                          roomType: 'Double Queen',
                          roomCount: 2,
                          offeredRate: 119,
                        },
                      ]);
                    }}
                    className="text-blue-600 hover:text-blue-700 font-bold flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Room Type</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {bookingRows.map((row, idx) => {
                    const rowSubtotal = row.roomCount * (bookingNights || 1) * row.offeredRate;
                    return (
                      <div
                        key={row.id || idx}
                        className="p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center gap-2"
                      >
                        <div className="flex-1">
                          <label className="text-[10px] text-gray-500 block mb-0.5">Room Type</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Standard King, Suite"
                            value={row.roomType}
                            onChange={(e) => {
                              const updated = [...bookingRows];
                              updated[idx].roomType = e.target.value;
                              setBookingRows(updated);
                            }}
                            className="w-full px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                          />
                        </div>

                        <div className="w-20">
                          <label className="text-[10px] text-gray-500 block mb-0.5">Rooms</label>
                          <input
                            type="number"
                            min={1}
                            required
                            value={row.roomCount}
                            onChange={(e) => {
                              const updated = [...bookingRows];
                              updated[idx].roomCount = Math.max(1, parseInt(e.target.value) || 1);
                              setBookingRows(updated);
                            }}
                            className="w-full px-2 py-1 text-center font-bold text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                          />
                        </div>

                        <div className="w-24">
                          <label className="text-[10px] text-gray-500 block mb-0.5">Rate ($/nt)</label>
                          <input
                            type="number"
                            min={1}
                            step="0.01"
                            required
                            value={row.offeredRate}
                            onChange={(e) => {
                              const updated = [...bookingRows];
                              updated[idx].offeredRate = parseFloat(e.target.value) || 0;
                              setBookingRows(updated);
                            }}
                            className="w-full px-2 py-1 text-right font-bold text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                          />
                        </div>

                        <div className="w-24 text-right pr-1">
                          <span className="text-[10px] text-gray-400 block mb-0.5">Subtotal</span>
                          <span className="font-extrabold text-emerald-700 dark:text-emerald-400 text-xs">
                            ${rowSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        {bookingRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setBookingRows(bookingRows.filter((_, i) => i !== idx));
                            }}
                            className="p-1 text-gray-400 hover:text-rose-600 rounded mt-3.5 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total Calculation Strip */}
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold block">
                    Total: {bookingRows.reduce((sum, r) => sum + r.roomCount, 0)} rooms × {bookingNights} night{bookingNights === 1 ? '' : 's'} ({bookingRows.reduce((sum, r) => sum + r.roomCount, 0) * bookingNights} room-nights)
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    Actual Closed Revenue Calculation
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-emerald-800 dark:text-emerald-200">
                    ${bookingRows.reduce((sum, r) => sum + (r.roomCount * (bookingNights || 1) * r.offeredRate), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setClosingDefiniteLead(null)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Win Definite</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
