import React, { useState } from 'react';
import {
  FileText,
  X,
  Building2,
  AlertTriangle,
  Tag,
  Check,
  ShieldCheck,
  User,
} from 'lucide-react';
import { ShiftLogEntry, UserAccount, PrimaryCategory, SalesLeadStatus, ComplaintStatus } from '../types';
import { DatabaseManager } from '../utils/database';
import { p2pSyncManager } from '../utils/p2pSyncManager';

interface FloatingExtensionBubbleProps {
  currentUser: UserAccount | null;
  onLogSaved: () => void;
  isOpen: boolean;
  onToggle: () => void;
  onRequireLogin?: () => void;
}

const db = new DatabaseManager();

export const FloatingExtensionBubble: React.FC<FloatingExtensionBubbleProps> = ({
  currentUser,
  onLogSaved,
  isOpen,
  onToggle,
  onRequireLogin,
}) => {
  const [activeCategory, setActiveCategory] = useState<PrimaryCategory>('Sales');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [subCategory, setSubCategory] = useState('Group');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [roomRequirement, setRoomRequirement] = useState(1);
  const [salesStatus, setSalesStatus] = useState<SalesLeadStatus>('New Lead');
  const [roomNumber, setRoomNumber] = useState('');
  const [reservationNumber, setReservationNumber] = useState('');
  const [topic, setTopic] = useState('');
  const [clerkNotes, setClerkNotes] = useState('');
  const [hasReminder, setHasReminder] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Calculate live revenue estimate
  const nights = React.useMemo(() => {
    if (!checkInDate || !checkOutDate) return 1;
    const d1 = new Date(checkInDate);
    const d2 = new Date(checkOutDate);
    const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  }, [checkInDate, checkOutDate]);

  const totalRoomNights = (roomRequirement || 1) * nights;
  const potentialRevenue = totalRoomNights * 120; // Default factor $120

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const timestamp = new Date().toISOString();
    const id = `log_${Date.now()}`;
    const clerkId = currentUser?.id || 'usr_clerk1';
    const clerkName = currentUser?.fullName || 'Front Desk Staff';

    let entry: ShiftLogEntry = {
      id,
      category: activeCategory,
      clerkId,
      clerkName,
      clerkNotes: clerkNotes.trim(),
      hasReminder,
      createdAt: timestamp,
      updatedAt: timestamp,
      responses: [],
    };

    if (activeCategory === 'Sales') {
      entry = {
        ...entry,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        subCategory,
        checkInDate: checkInDate || undefined,
        checkOutDate: checkOutDate || undefined,
        roomRequirement,
        totalRoomNights,
        potentialRevenue,
        salesStatus,
      };
    } else if (activeCategory === 'Complaint') {
      entry = {
        ...entry,
        name: name.trim(),
        phone: phone.trim(),
        roomNumber: roomNumber.trim() || undefined,
        reservationNumber: reservationNumber.trim() || undefined,
        complaintStatus: 'Open' as ComplaintStatus,
      };
    } else {
      entry = {
        ...entry,
        topic: topic.trim() || 'Shift Note',
      };
    }

    await db.saveShiftLog(entry);
    p2pSyncManager.broadcastShiftLog(entry);
    onLogSaved();

    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      setName('');
      setPhone('');
      setEmail('');
      setTopic('');
      setClerkNotes('');
      setRoomNumber('');
      setReservationNumber('');
      onToggle();
    }, 1200);
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        id="fdp-inapp-bubble"
        data-fdp-inapp-bubble="true"
        type="button"
        onClick={onToggle}
        title="FrontDesk Pro — Floating Shift Log"
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xl hover:shadow-2xl flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 z-50 group border-2 border-white"
      >
        <FileText className="w-6 h-6 text-white" />
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></span>
      </button>

      {/* Floating Modal Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 max-w-[calc(100vw-32px)] max-h-[calc(100vh-120px)] bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="bg-slate-900 text-white p-3.5 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <img src="/favicon.png" alt="FrontDesk Pro" className="w-5 h-5 rounded" />
              <div>
                <h4 className="text-xs font-bold tracking-tight">FrontDesk Pro — Quick Log</h4>
                <p className="text-[10px] text-gray-400">Floating Clerk Assistant</p>
              </div>
            </div>
            <button
              onClick={onToggle}
              className="text-gray-400 hover:text-white p-1 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Staff Login Indicator */}
          {currentUser ? (
            <div className="bg-slate-50 px-3.5 py-1.5 border-b border-gray-200 flex items-center justify-between text-[11px]">
              <div className="flex items-center space-x-1.5">
                {currentUser.role === 'manager' ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                ) : (
                  <User className="w-3.5 h-3.5 text-gray-500" />
                )}
                <span className="text-gray-600">Logged in:</span>
                <strong className="text-gray-900">{currentUser.fullName}</strong>
              </div>
              <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded ${
                currentUser.role === 'manager' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {currentUser.role}
              </span>
            </div>
          ) : (
            <div className="bg-amber-50 px-3.5 py-2 border-b border-amber-200 flex items-center justify-between text-[11px]">
              <div className="flex items-center space-x-1.5 text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span className="font-semibold">Not Signed In</span>
              </div>
              {onRequireLogin && (
                <button
                  type="button"
                  onClick={() => {
                    onToggle();
                    onRequireLogin();
                  }}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[10px] font-bold transition shadow-xs cursor-pointer"
                >
                  Sign In First &rarr;
                </button>
              )}
            </div>
          )}

          {!currentUser ? (
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
                <User className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-gray-900 text-sm">Staff Authentication Required</h4>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">
                Please sign in to your FrontDesk Pro staff account to record and audit shift logs, guest complaints, and group sales leads.
              </p>
              {onRequireLogin && (
                <button
                  type="button"
                  onClick={() => {
                    onToggle();
                    onRequireLogin();
                  }}
                  className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition"
                >
                  Sign In to FrontDesk Pro
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Category Tabs */}
              <div className="flex p-1 m-3 bg-gray-100 rounded-xl gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveCategory('Sales')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center space-x-1 transition ${
                    activeCategory === 'Sales' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Sales</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory('Complaint')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center space-x-1 transition ${
                    activeCategory === 'Complaint' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Complaint</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory('Miscellaneous')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center space-x-1 transition ${
                    activeCategory === 'Miscellaneous' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Note</span>
                </button>
              </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-3.5 pt-0 overflow-y-auto space-y-2.5 text-xs flex-1">
            {/* SALES FIELDS */}
            {activeCategory === 'Sales' && (
              <>
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Subcategory</label>
                  <select
                    value={subCategory}
                    onChange={(e) => setSubCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Group">Group Booking</option>
                    <option value="Wedding">Wedding Party</option>
                    <option value="Sports team">Sports Team</option>
                    <option value="Company">Company / Corporate</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Lead / Contact Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Tech Conference"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Phone *</label>
                    <input
                      type="text"
                      required
                      placeholder="(555) 000-0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="name@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Check-in</label>
                    <input
                      type="date"
                      value={checkInDate}
                      onChange={(e) => setCheckInDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Check-out</label>
                    <input
                      type="date"
                      value={checkOutDate}
                      onChange={(e) => setCheckOutDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Rooms</label>
                    <input
                      type="number"
                      min="1"
                      value={roomRequirement}
                      onChange={(e) => setRoomRequirement(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Pipeline Status</label>
                    <select
                      value={salesStatus}
                      onChange={(e) => setSalesStatus(e.target.value as SalesLeadStatus)}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                    >
                      <option value="New Lead">1. New Lead</option>
                      <option value="Processing">2. Processing</option>
                      <option value="Closed Definite">3. Definite (Won)</option>
                      <option value="Lost">4. Lost</option>
                    </select>
                  </div>
                </div>

                {/* Revenue estimate */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex items-center justify-between text-[11px] text-emerald-800 font-semibold">
                  <span>Room Nights: <strong>{totalRoomNights}</strong></span>
                  <span>Est. Revenue: <strong>${potentialRevenue.toLocaleString()}</strong></span>
                </div>
              </>
            )}

            {/* COMPLAINT FIELDS */}
            {activeCategory === 'Complaint' && (
              <>
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Guest Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Guest Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Phone *</label>
                    <input
                      type="text"
                      required
                      placeholder="(555) 000-0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Room #</label>
                    <input
                      type="text"
                      placeholder="e.g. 214"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Reservation # (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. RES-49102"
                    value={reservationNumber}
                    onChange={(e) => setReservationNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            {/* MISC FIELDS */}
            {activeCategory === 'Miscellaneous' && (
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Topic / Subject *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Parking gate key, Luggage drop"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Clerk Notes / Context</label>
              <textarea
                rows={2}
                placeholder="Details, special requests, or handover notes..."
                value={clerkNotes}
                onChange={(e) => setClerkNotes(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Reminder */}
            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="floating-has-reminder"
                checked={hasReminder}
                onChange={(e) => setHasReminder(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="floating-has-reminder" className="text-gray-600 text-[11px] cursor-pointer">
                Set follow-up reminder for oncoming shift
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition flex items-center justify-center space-x-1.5 mt-2"
            >
              <Check className="w-4 h-4" />
              <span>Save Shift Log</span>
            </button>

            {isSuccess && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-2 rounded-lg text-center font-bold text-xs animate-in fade-in">
                ✓ Shift log recorded and synced to register!
              </div>
            )}
          </form>
        </>
      )}
    </div>
      )}
    </>
  );
};
