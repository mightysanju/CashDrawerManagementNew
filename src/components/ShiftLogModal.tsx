import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Tag, 
  Calendar, 
  Clock, 
  DollarSign, 
  Building2, 
  Phone, 
  Mail, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Bell, 
  HelpCircle,
  ListChecks 
} from 'lucide-react';
import { 
  ShiftLogEntry, 
  PrimaryCategory, 
  SalesLeadStatus, 
  ComplaintStatus, 
  LogCategoryConfig,
  CategoryQuestionItem,
  getDefaultQuestionnaireForCategory,
  AppSettings, 
  UserAccount,
  FormFieldKey,
  DEFAULT_FORM_FIELD_SETTINGS,
  ActivityLogEvent,
  ShiftLogStatusChange
} from '../types';
import { DatabaseManager } from '../utils/database';
import { p2pSyncManager } from '../utils/p2pSyncManager';
import { getCategoryIconComponent } from '../utils/categoryIcons';

interface ShiftLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
  currentShiftId?: string;
  drawerNumber?: string;
  defaultCategory?: PrimaryCategory;
  editEntry?: ShiftLogEntry | null;
  onSaved: (entry: ShiftLogEntry) => void;
}

const db = new DatabaseManager();

export const ShiftLogModal: React.FC<ShiftLogModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentShiftId,
  drawerNumber,
  defaultCategory = 'Sales',
  editEntry,
  onSaved,
}) => {
  const [categories, setCategories] = useState<LogCategoryConfig[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    id: 'default',
    salesRateMultiplier: 120,
    organizationName: 'Grand Hotel & Suites',
  });

  // Common fields
  const [category, setCategory] = useState<PrimaryCategory>('Sales');
  const [subCategory, setSubCategory] = useState<string>('Group');
  const [clerkNotes, setClerkNotes] = useState('');

  // Sales Lead Fields
  const [guestName, setGuestName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [roomRequirement, setRoomRequirement] = useState<number>(5);
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [salesStatus, setSalesStatus] = useState<SalesLeadStatus>('New Lead');

  // Complaint Fields
  const [complaintGuestName, setComplaintGuestName] = useState('');
  const [complaintPhone, setComplaintPhone] = useState('');
  const [reservationNumber, setReservationNumber] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [complaintStatus, setComplaintStatus] = useState<ComplaintStatus>('Open');

  // Misc Fields
  const [topic, setTopic] = useState('');

  // Reminder Fields
  const [hasReminder, setHasReminder] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderNote, setReminderNote] = useState('');

  // Dynamic Custom Fields State
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  const [error, setError] = useState<string | null>(null);

  // Load categories and settings
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      try {
        const [cats, appSettings] = await Promise.all([
          db.getCategories(),
          db.getSettings(),
        ]);
        setCategories(cats);
        setSettings(appSettings);
      } catch (err) {
        console.error('Failed to load categories/settings:', err);
      }
    };
    loadData();

    // Default dates for sales (today + 7 days out)
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 2);
    
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    
    if (editEntry) {
      setCategory(editEntry.category);
      setSubCategory(editEntry.subCategory || 'Group');
      setClerkNotes(editEntry.clerkNotes || '');

      // Sales
      setGuestName(editEntry.name || '');
      setPhoneNumber(editEntry.phoneNumber || '');
      setEmail(editEntry.email || '');
      setRoomRequirement(editEntry.roomRequirement || 1);
      setCheckInDate(editEntry.checkInDate || fmt(today));
      setCheckOutDate(editEntry.checkOutDate || fmt(nextWeek));
      setSalesStatus(editEntry.salesStatus || 'New Lead');

      // Complaint
      setComplaintGuestName(editEntry.name || '');
      setComplaintPhone(editEntry.phoneNumber || '');
      setReservationNumber(editEntry.reservationNumber || '');
      setRoomNumber(editEntry.roomNumber || '');
      setComplaintStatus(editEntry.complaintStatus || 'Open');

      // Misc
      setTopic(editEntry.topic || '');

      // Reminder
      setHasReminder(!!editEntry.hasReminder);
      setReminderDate(editEntry.reminderDate || '');
      setReminderNote(editEntry.reminderNote || '');

      // Custom fields
      setCustomFieldValues(editEntry.customFields || {});
    } else {
      // New Entry Defaults
      setCategory(defaultCategory);
      setSubCategory('Group');
      setClerkNotes('');
      setGuestName('');
      setPhoneNumber('');
      setEmail('');
      setRoomRequirement(5);
      setCheckInDate(fmt(today));
      setCheckOutDate(fmt(nextWeek));
      setSalesStatus('New Lead');

      setComplaintGuestName('');
      setComplaintPhone('');
      setReservationNumber('');
      setRoomNumber('');
      setComplaintStatus('Open');

      setTopic('');

      setHasReminder(false);
      setReminderDate('');
      setReminderNote('');
      setCustomFieldValues({});
    }
    setError(null);
  }, [isOpen, editEntry, defaultCategory]);

  if (!isOpen) return null;

  // Selected category config
  const currentCatConfig = categories.find((c) => c.name.toLowerCase() === category.toLowerCase());
  const subcategories = (currentCatConfig?.subcategories && currentCatConfig.subcategories.length > 0)
    ? currentCatConfig.subcategories
    : category === 'Sales'
    ? ['Group', 'Wedding', 'Sports team', 'Company', 'Other']
    : category === 'Complaint'
    ? ['Room Maintenance', 'Noise / Disturbance', 'Billing & Folio', 'Housekeeping / Cleanliness', 'Staff / Service', 'Other']
    : ['General', 'Maintenance', 'Shift Handover', 'Front Desk', 'Other'];

  // Category Questionnaire (Per-Category Questionnaire Configuration)
  const categoryQuestionnaire = useMemo(() => {
    if (currentCatConfig?.questionnaire && currentCatConfig.questionnaire.length > 0) {
      return currentCatConfig.questionnaire;
    }
    return getDefaultQuestionnaireForCategory(category);
  }, [currentCatConfig, category]);

  const isFieldRequired = (key: string, defaultRequired: boolean = false): boolean => {
    const item = categoryQuestionnaire.find((q) => q.id === key);
    if (item) {
      return item.enabled !== false && item.required;
    }
    return defaultRequired;
  };

  const isFieldEnabled = (key: string, defaultEnabled: boolean = true): boolean => {
    const item = categoryQuestionnaire.find((q) => q.id === key);
    if (item) {
      return item.enabled !== false;
    }
    return defaultEnabled;
  };

  const getFieldLabel = (key: string, defaultLabel: string): string => {
    const item = categoryQuestionnaire.find((q) => q.id === key);
    return item?.label || defaultLabel;
  };

  const standardQuestionIds = useMemo(() => new Set([
    'guestName', 'phoneNumber', 'email', 'roomRequirement', 'dates',
    'clerkNotes', 'reminder', 'roomNumber', 'reservationNumber', 'topic', 'subCategory'
  ]), []);

  const customQuestions = useMemo(() => {
    return categoryQuestionnaire.filter((q) => !standardQuestionIds.has(q.id) && q.enabled !== false);
  }, [categoryQuestionnaire, standardQuestionIds]);

  // Dynamic calculations for Sales
  const calculateSalesStats = () => {
    if (!checkInDate || !checkOutDate) {
      return { nights: 0, totalRoomNights: 0, potentialRevenue: 0 };
    }
    const start = new Date(checkInDate).getTime();
    const end = new Date(checkOutDate).getTime();
    const diffDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
    const rooms = Math.max(1, Number(roomRequirement) || 1);
    const totalRoomNights = rooms * diffDays;
    const rate = settings.salesRateMultiplier || 120;
    const potentialRevenue = totalRoomNights * rate;

    return { nights: diffDays, totalRoomNights, potentialRevenue };
  };

  const { nights, totalRoomNights, potentialRevenue } = calculateSalesStats();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const nowIso = new Date().toISOString();

    // Validation using dynamic Questionnaire configuration
    if (category === 'Sales') {
      if (isFieldRequired('guestName', true) && !guestName.trim()) {
        setError(`${getFieldLabel('guestName', 'Organizer / Group Name')} is required.`);
        return;
      }
      if (isFieldRequired('phoneNumber', true) && !phoneNumber.trim()) {
        setError(`${getFieldLabel('phoneNumber', 'Phone Number')} is required.`);
        return;
      }
      if (isFieldRequired('email', false) && !email.trim()) {
        setError(`${getFieldLabel('email', 'Email Address')} is required.`);
        return;
      }
      if (isFieldRequired('roomRequirement', true) && (!roomRequirement || roomRequirement <= 0)) {
        setError('Please provide a valid Room Requirement count.');
        return;
      }
      if (isFieldRequired('dates', true) && (!checkInDate || !checkOutDate)) {
        setError('Please provide valid Check-in and Check-out dates.');
        return;
      }
      if (checkInDate && checkOutDate && new Date(checkOutDate) <= new Date(checkInDate)) {
        setError('Check-out date must be after check-in date.');
        return;
      }
      if (isFieldRequired('clerkNotes', true) && !clerkNotes.trim()) {
        setError(`${getFieldLabel('clerkNotes', 'Clerk Notes')} are required.`);
        return;
      }
    } else if (category === 'Complaint') {
      if (isFieldRequired('guestName', true) && !complaintGuestName.trim()) {
        setError(`${getFieldLabel('guestName', 'Guest Name')} is required.`);
        return;
      }
      if (isFieldRequired('phoneNumber', true) && !complaintPhone.trim()) {
        setError(`${getFieldLabel('phoneNumber', 'Guest Phone Number')} is required.`);
        return;
      }
      if (isFieldRequired('roomNumber', false) && !roomNumber.trim()) {
        setError(`${getFieldLabel('roomNumber', 'Room Number')} is required.`);
        return;
      }
      if (isFieldRequired('reservationNumber', false) && !reservationNumber.trim()) {
        setError(`${getFieldLabel('reservationNumber', 'Reservation Number')} is required.`);
        return;
      }
      if (isFieldRequired('clerkNotes', false) && !clerkNotes.trim()) {
        setError(`${getFieldLabel('clerkNotes', 'Complaint Details / Notes')} are required.`);
        return;
      }
    } else {
      if (isFieldRequired('topic', false) && !topic.trim()) {
        setError(`${getFieldLabel('topic', 'Topic / Headline')} is required.`);
        return;
      }
      if (isFieldRequired('clerkNotes', true) && !clerkNotes.trim()) {
        setError(`${getFieldLabel('clerkNotes', 'Notes')} are required.`);
        return;
      }
    }

    // Validation for any dynamic custom questions configured on this category
    for (const q of customQuestions) {
      if (q.required && (!customFieldValues[q.id] || !customFieldValues[q.id].trim())) {
        setError(`${q.label} is required.`);
        return;
      }
    }

    const entryId = editEntry ? editEntry.id : `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newLog: ShiftLogEntry = {
      id: entryId,
      shiftId: editEntry?.shiftId || currentShiftId,
      drawerNumber: editEntry?.drawerNumber || drawerNumber,
      clerkId: editEntry?.clerkId || currentUser.id,
      clerkName: editEntry?.clerkName || currentUser.fullName || currentUser.username,
      createdAt: editEntry?.createdAt || nowIso,
      updatedAt: nowIso,
      category,
      clerkNotes: clerkNotes.trim(),
      hasReminder,
      reminderDate: hasReminder ? reminderDate : undefined,
      reminderNote: hasReminder ? reminderNote.trim() : undefined,
      isReminderCompleted: editEntry?.isReminderCompleted || false,
      responses: editEntry?.responses || [],
      customFields: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
    };

    if (category === 'Sales') {
      newLog.name = guestName.trim();
      newLog.phoneNumber = phoneNumber.trim();
      newLog.email = email.trim();
      newLog.subCategory = subCategory;
      newLog.roomRequirement = Number(roomRequirement);
      newLog.checkInDate = checkInDate;
      newLog.checkOutDate = checkOutDate;
      newLog.totalRoomNights = totalRoomNights;
      newLog.potentialRevenue = potentialRevenue;
      newLog.salesStatus = salesStatus;
    } else if (category === 'Complaint') {
      newLog.name = complaintGuestName.trim();
      newLog.phoneNumber = complaintPhone.trim();
      newLog.reservationNumber = reservationNumber.trim() || undefined;
      newLog.roomNumber = roomNumber.trim() || undefined;
      newLog.complaintStatus = complaintStatus;
      newLog.subCategory = subCategory;
    } else {
      // Miscellaneous / Custom
      newLog.topic = topic.trim() || undefined;
      newLog.name = guestName.trim() || undefined;
      newLog.phoneNumber = phoneNumber.trim() || undefined;
      newLog.roomNumber = roomNumber.trim() || undefined;
      newLog.subCategory = subCategory;
    }

    try {
      const title = newLog.topic || newLog.name || `${newLog.category} Log`;

      // Check for status changes when editing
      if (editEntry) {
        if (newLog.category === 'Complaint' && editEntry.complaintStatus !== newLog.complaintStatus) {
          const statusEvent: ActivityLogEvent = {
            id: `status_${newLog.id}_${Date.now()}`,
            type: 'status',
            logId: newLog.id,
            category: 'Complaint',
            subCategory: newLog.subCategory,
            logTitle: title,
            actor: currentUser.fullName,
            actorRole: currentUser.role,
            summary: `Complaint marked as ${newLog.complaintStatus} (from ${editEntry.complaintStatus || 'Open'})`,
            detail: newLog.clerkNotes,
            timestamp: newLog.updatedAt || new Date().toISOString(),
            badgeText: newLog.complaintStatus || 'Open',
            badgeColor: newLog.complaintStatus === 'Resolved'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
          };
          await db.saveActivityEvent(statusEvent);
          p2pSyncManager.broadcastActivityEvent(statusEvent);
        } else if (newLog.category === 'Sales' && editEntry.salesStatus !== newLog.salesStatus) {
          const statusEvent: ActivityLogEvent = {
            id: `sales_status_${newLog.id}_${Date.now()}`,
            type: 'status',
            logId: newLog.id,
            category: 'Sales',
            subCategory: newLog.subCategory,
            logTitle: title,
            actor: currentUser.fullName,
            actorRole: currentUser.role,
            summary: `Sales lead status updated to ${newLog.salesStatus} (from ${editEntry.salesStatus || 'New Lead'})`,
            detail: newLog.clerkNotes,
            timestamp: newLog.updatedAt || new Date().toISOString(),
            badgeText: newLog.salesStatus || 'New Lead',
            badgeColor: newLog.salesStatus === 'Closed Definite'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
          };
          await db.saveActivityEvent(statusEvent);
          p2pSyncManager.broadcastActivityEvent(statusEvent);
        }
      } else {
        // New log creation event
        const createEvent: ActivityLogEvent = {
          id: `created_${newLog.id}`,
          type: 'created',
          logId: newLog.id,
          category: newLog.category,
          subCategory: newLog.subCategory,
          logTitle: title,
          actor: currentUser.fullName,
          actorRole: currentUser.role,
          summary: `Created ${newLog.category.toLowerCase()} log: "${title}"`,
          detail: newLog.clerkNotes || newLog.topic,
          timestamp: newLog.createdAt,
          badgeText: 'New Log',
          badgeColor: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        };
        await db.saveActivityEvent(createEvent);
        p2pSyncManager.broadcastActivityEvent(createEvent);
      }

      await db.saveShiftLog(newLog);
      p2pSyncManager.broadcastShiftLog(newLog);
      onSaved(newLog);
      onClose();
    } catch (err) {
      console.error('Failed to save log entry:', err);
      setError('Database error while saving log entry.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full my-8 overflow-hidden border border-gray-100 dark:border-gray-700 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-slate-800 text-slate-200 rounded-xl border border-slate-700">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {editEntry ? 'Edit Shift Log Entry' : 'New Shift Log & Hospitality Lead'}
              </h2>
              <p className="text-xs text-slate-400">
                Logged by {currentUser.fullName} ({currentUser.role})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl flex items-start space-x-2 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Category Selector Tabs */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
              Log Category
            </label>
            <div className={`grid gap-2 ${
              categories.length <= 3 
                ? 'grid-cols-3' 
                : categories.length === 4 
                ? 'grid-cols-2 sm:grid-cols-4' 
                : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
            }`}>
              {(categories.length > 0 ? categories : [
                { id: 'cat_sales', name: 'Sales', icon: 'Building2', subcategories: [] },
                { id: 'cat_complaint', name: 'Complaint', icon: 'AlertTriangle', subcategories: [] },
                { id: 'cat_misc', name: 'Miscellaneous', icon: 'Tag', subcategories: [] }
              ]).map((cat) => {
                const isSelected = category.toLowerCase() === cat.name.toLowerCase();
                const IconComponent = getCategoryIconComponent(cat.icon);
                return (
                  <button
                    key={cat.id || cat.name}
                    type="button"
                    onClick={() => {
                      setCategory(cat.name);
                      if (cat.subcategories && cat.subcategories.length > 0) {
                        setSubCategory(cat.subcategories[0]);
                      }
                      setError(null);
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center space-x-2 transition cursor-pointer ${
                      isSelected
                        ? cat.name === 'Sales'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : cat.name === 'Complaint'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <IconComponent className="w-4 h-4 shrink-0" />
                    <span className="truncate">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* -------------------- SALES CATEGORY FORM -------------------- */}
          {category === 'Sales' && (
            <div className="space-y-4 pt-1 animate-fade-in">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 font-semibold text-sm">
                    <Building2 className="w-4 h-4" />
                    <span>Sales Lead Questionnaire</span>
                  </div>
                  <span className="text-xs bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 px-2.5 py-0.5 rounded-full font-medium">
                    Rate: ${settings.salesRateMultiplier || 120}/room-night
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  {/* Subcategory */}
                  <div>
                    <label className="block text-xs font-medium text-emerald-900 dark:text-emerald-200 mb-1">
                      {getFieldLabel('subCategory', 'Lead Type / Subcategory')} {isFieldRequired('subCategory', true) ? '*' : '(Optional)'}
                    </label>
                    <select
                      value={subCategory}
                      onChange={(e) => setSubCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-emerald-300 dark:border-emerald-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {subcategories.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-xs font-medium text-emerald-900 dark:text-emerald-200 mb-1">
                      Lead Pipeline Status *
                    </label>
                    <select
                      value={salesStatus}
                      onChange={(e) => setSalesStatus(e.target.value as SalesLeadStatus)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-emerald-300 dark:border-emerald-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="New Lead">New Lead</option>
                      <option value="Processing">Processing</option>
                      <option value="Tentative / Contract Sent">Tentative / Contract Sent</option>
                      <option value="Closed Definite">Closed Definite (Won)</option>
                      <option value="Lost">Lost</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  {/* Organizer / Guest Name */}
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-emerald-900 dark:text-emerald-200 mb-1">
                      {getFieldLabel('guestName', 'Name (Organizer/Guest)')} {isFieldRequired('guestName', true) ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="text"
                      required={isFieldRequired('guestName', true)}
                      placeholder="e.g. John Miller"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-emerald-300 dark:border-emerald-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-medium text-emerald-900 dark:text-emerald-200 mb-1">
                      {getFieldLabel('phoneNumber', 'Phone Number')} {isFieldRequired('phoneNumber', true) ? '*' : '(Optional)'}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                        <Phone className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type="tel"
                        required={isFieldRequired('phoneNumber', true)}
                        placeholder="(555) 000-0000"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-white dark:bg-gray-800 border border-emerald-300 dark:border-emerald-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-medium text-emerald-900 dark:text-emerald-200 mb-1">
                      {getFieldLabel('email', 'Email Address')} {isFieldRequired('email', false) ? '*' : '(Optional)'}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                        <Mail className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type="email"
                        required={isFieldRequired('email', false)}
                        placeholder="client@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-white dark:bg-gray-800 border border-emerald-300 dark:border-emerald-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Stay Dates and Room Count */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-emerald-900 dark:text-emerald-200 mb-1">
                      {getFieldLabel('roomRequirement', 'Room Requirement')} {isFieldRequired('roomRequirement', true) ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      required={isFieldRequired('roomRequirement', true)}
                      value={roomRequirement}
                      onChange={(e) => setRoomRequirement(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-emerald-300 dark:border-emerald-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-emerald-900 dark:text-emerald-200 mb-1">
                      Check-in Date {isFieldRequired('dates', true) ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="date"
                      required={isFieldRequired('dates', true)}
                      value={checkInDate}
                      onChange={(e) => setCheckInDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-emerald-300 dark:border-emerald-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-emerald-900 dark:text-emerald-200 mb-1">
                      Check-out Date {isFieldRequired('dates', true) ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="date"
                      required={isFieldRequired('dates', true)}
                      value={checkOutDate}
                      onChange={(e) => setCheckOutDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-emerald-300 dark:border-emerald-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Automatic Revenue & Room Nights Calculation Banner */}
                <div className="mt-4 p-3 bg-emerald-100/70 dark:bg-emerald-900/40 rounded-xl border border-emerald-300 dark:border-emerald-700/60 flex items-center justify-between text-xs text-emerald-950 dark:text-emerald-100">
                  <div className="flex items-center space-x-1.5 font-medium">
                    <Calendar className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
                    <span>Duration: <strong>{nights} night{nights !== 1 ? 's' : ''}</strong></span>
                  </div>
                  <div className="flex items-center space-x-1.5 font-medium">
                    <Building2 className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
                    <span>Potential Room Nights: <strong>{totalRoomNights}</strong></span>
                  </div>
                  <div className="flex items-center space-x-1.5 font-bold text-emerald-800 dark:text-emerald-200 text-sm">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <span>Potential Est. Revenue: ${potentialRevenue.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* -------------------- COMPLAINT CATEGORY FORM -------------------- */}
          {category === 'Complaint' && (
            <div className="space-y-4 pt-1 animate-fade-in">
              <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl p-4">
                <div className="flex items-center space-x-2 text-rose-800 dark:text-rose-300 font-semibold text-sm mb-3">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Guest Complaint Questionnaire</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-rose-900 dark:text-rose-200 mb-1">
                      {getFieldLabel('guestName', 'Guest Name')} {isFieldRequired('guestName', true) ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="text"
                      required={isFieldRequired('guestName', true)}
                      placeholder="e.g. Sarah Connor"
                      value={complaintGuestName}
                      onChange={(e) => setComplaintGuestName(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-rose-300 dark:border-rose-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-rose-900 dark:text-rose-200 mb-1">
                      {getFieldLabel('phoneNumber', 'Phone Number')} {isFieldRequired('phoneNumber', true) ? '*' : '(Optional)'}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                        <Phone className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type="tel"
                        required={isFieldRequired('phoneNumber', true)}
                        placeholder="(555) 000-0000"
                        value={complaintPhone}
                        onChange={(e) => setComplaintPhone(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-white dark:bg-gray-800 border border-rose-300 dark:border-rose-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-rose-900 dark:text-rose-200 mb-1">
                      {getFieldLabel('subCategory', 'Subcategory')} {isFieldRequired('subCategory', true) ? '*' : '(Optional)'}
                    </label>
                    <select
                      value={subCategory}
                      onChange={(e) => setSubCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-rose-300 dark:border-rose-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      {subcategories.map((sub) => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-rose-900 dark:text-rose-200 mb-1">
                      {getFieldLabel('reservationNumber', 'Reservation #')} {isFieldRequired('reservationNumber', false) ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="text"
                      required={isFieldRequired('reservationNumber', false)}
                      placeholder="e.g. RES-98210"
                      value={reservationNumber}
                      onChange={(e) => setReservationNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-rose-300 dark:border-rose-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-rose-900 dark:text-rose-200 mb-1">
                      {getFieldLabel('roomNumber', 'Room #')} {isFieldRequired('roomNumber', false) ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="text"
                      required={isFieldRequired('roomNumber', false)}
                      placeholder="e.g. 304"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-rose-300 dark:border-rose-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-rose-900 dark:text-rose-200 mb-1">
                      Status
                    </label>
                    <select
                      value={complaintStatus}
                      onChange={(e) => setComplaintStatus(e.target.value as ComplaintStatus)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-rose-300 dark:border-rose-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* -------------------- MISCELLANEOUS CATEGORY FORM -------------------- */}
          {category === 'Miscellaneous' && (
            <div className="space-y-4 pt-1 animate-fade-in">
              <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-xl p-4">
                <div className="flex items-center space-x-2 text-indigo-800 dark:text-indigo-300 font-semibold text-sm mb-3">
                  <Tag className="w-4 h-4" />
                  <span>Miscellaneous Shift Note</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-indigo-900 dark:text-indigo-200 mb-1">
                      {getFieldLabel('topic', 'Topic / Subject')} {isFieldRequired('topic', false) ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="text"
                      required={isFieldRequired('topic', false)}
                      placeholder="e.g. Keycard encoder firmware updated, Lost & Found item handed over"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-indigo-300 dark:border-indigo-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-indigo-900 dark:text-indigo-200 mb-1">
                      {getFieldLabel('subCategory', 'Subcategory')} {isFieldRequired('subCategory', true) ? '*' : '(Optional)'}
                    </label>
                    <select
                      value={subCategory}
                      onChange={(e) => setSubCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-indigo-300 dark:border-indigo-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {subcategories.map((sub) => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-indigo-900 dark:text-indigo-200 mb-1">
                      {getFieldLabel('guestName', 'Name / Caller')} {isFieldRequired('guestName', false) ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="text"
                      required={isFieldRequired('guestName', false)}
                      placeholder="e.g. Caller or staff name"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-indigo-300 dark:border-indigo-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-indigo-900 dark:text-indigo-200 mb-1">
                      {getFieldLabel('phoneNumber', 'Phone Number')} {isFieldRequired('phoneNumber', false) ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="tel"
                      required={isFieldRequired('phoneNumber', false)}
                      placeholder="(555) 000-0000"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-indigo-300 dark:border-indigo-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-indigo-900 dark:text-indigo-200 mb-1">
                      {getFieldLabel('roomNumber', 'Room #')} {isFieldRequired('roomNumber', false) ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="text"
                      required={isFieldRequired('roomNumber', false)}
                      placeholder="e.g. 102"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-indigo-300 dark:border-indigo-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* -------------------- CUSTOM CATEGORY FORM -------------------- */}
          {category !== 'Sales' && category !== 'Complaint' && category !== 'Miscellaneous' && (
            <div className="space-y-4 pt-1 animate-fade-in">
              <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 rounded-xl p-4">
                <div className="flex items-center space-x-2 text-purple-800 dark:text-purple-300 font-semibold text-sm mb-3">
                  <Tag className="w-4 h-4" />
                  <span>{category} Questionnaire</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-purple-900 dark:text-purple-200 mb-1">
                      {getFieldLabel('topic', 'Title / Reference')} {isFieldRequired('topic', false) ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="text"
                      required={isFieldRequired('topic', false)}
                      placeholder={`e.g. ${category} record / activity`}
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-purple-300 dark:border-purple-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-purple-900 dark:text-purple-200 mb-1">
                      {getFieldLabel('subCategory', 'Subcategory')} {isFieldRequired('subCategory', true) ? '*' : '(Optional)'}
                    </label>
                    <select
                      value={subCategory}
                      onChange={(e) => setSubCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-purple-300 dark:border-purple-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {subcategories.map((sub) => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-purple-900 dark:text-purple-200 mb-1">
                      {getFieldLabel('guestName', 'Contact / Guest Name')} {isFieldRequired('guestName', false) ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="text"
                      required={isFieldRequired('guestName', false)}
                      placeholder="e.g. Staff member or guest name"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-purple-300 dark:border-purple-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-purple-900 dark:text-purple-200 mb-1">
                      {getFieldLabel('phoneNumber', 'Phone Number')} {isFieldRequired('phoneNumber', false) ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="tel"
                      required={isFieldRequired('phoneNumber', false)}
                      placeholder="(555) 000-0000"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-purple-300 dark:border-purple-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-purple-900 dark:text-purple-200 mb-1">
                      {getFieldLabel('roomNumber', 'Room #')} {isFieldRequired('roomNumber', false) ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="text"
                      required={isFieldRequired('roomNumber', false)}
                      placeholder="e.g. 214"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-purple-300 dark:border-purple-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Category Custom Questionnaire Fields */}
          {customQuestions.length > 0 && (
            <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800/60 space-y-3">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-blue-950 dark:text-blue-200">
                <ListChecks className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Custom Questionnaire Questions ({customQuestions.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {customQuestions.map((q) => (
                  <div key={q.id}>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      {q.label} {q.required ? <span className="text-rose-500 font-bold">*</span> : <span className="text-gray-400 font-normal text-[11px]">(Optional)</span>}
                    </label>
                    <input
                      type="text"
                      required={q.required}
                      placeholder={`Enter ${q.label}...`}
                      value={customFieldValues[q.id] || ''}
                      onChange={(e) => setCustomFieldValues({ ...customFieldValues, [q.id]: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Universal Clerk Notes */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                {getFieldLabel('clerkNotes', 'Clerk Notes')} {isFieldRequired('clerkNotes', category === 'Sales') ? '(Required)' : '(Optional)'}
              </label>
              {isFieldRequired('clerkNotes', category === 'Sales') && (
                <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">Required</span>
              )}
            </div>
            <textarea
              rows={3}
              required={isFieldRequired('clerkNotes', category === 'Sales')}
              placeholder={
                category === 'Sales'
                  ? 'Detail group preferences, tax exempt status, meeting room requirements, deposit requirements...'
                  : category === 'Complaint'
                  ? 'Describe guest concern, action taken, compensation or discount offered, etc.'
                  : 'Additional observations or notes for the incoming shift...'
              }
              value={clerkNotes}
              onChange={(e) => setClerkNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* -------------------- REMINDER SYSTEM -------------------- */}
          <div className="border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/20 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasReminder}
                  onChange={(e) => setHasReminder(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm font-semibold text-amber-900 dark:text-amber-200 flex items-center space-x-1.5">
                  <Bell className="w-4 h-4 text-amber-600" />
                  <span>Set Follow-Up Reminder on Reminders Tab</span>
                </span>
              </label>
              <span className="text-xs text-amber-700 dark:text-amber-400">
                Visible to every clerk on shift
              </span>
            </div>

            {hasReminder && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 animate-fade-in pt-2 border-t border-amber-200 dark:border-amber-800/50">
                <div>
                  <label className="block text-xs font-medium text-amber-900 dark:text-amber-200 mb-1">
                    Reminder Date & Time *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="datetime-local"
                      required={hasReminder}
                      value={reminderDate}
                      onChange={(e) => setReminderDate(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-amber-900 dark:text-amber-200 mb-1">
                    Reminder Note / Action Required
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Call client back with proposal, Check AC in room 304"
                    value={reminderNote}
                    onChange={(e) => setReminderNote(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Shift Link Info */}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-1">
            <span className="flex items-center space-x-1">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>
                Linked to: {drawerNumber ? `Drawer #${drawerNumber}` : 'General Shift Log'}
              </span>
            </span>
            <span>All entries sync locally & instantly to peer registers</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl shadow-xs transition flex items-center space-x-2 cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{editEntry ? 'Save Changes' : 'Save Shift Log'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
