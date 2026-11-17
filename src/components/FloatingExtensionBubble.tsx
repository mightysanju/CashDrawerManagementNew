import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Building2,
  AlertTriangle,
  Tag,
  Check,
  ShieldCheck,
  User,
} from 'lucide-react';
import { 
  ShiftLogEntry, 
  UserAccount, 
  PrimaryCategory, 
  SalesLeadStatus, 
  ComplaintStatus,
  LogCategoryConfig,
  getDefaultQuestionnaireForCategory,
  AppSettings,
  FormFieldKey,
  DEFAULT_FORM_FIELD_SETTINGS
} from '../types';
import { DatabaseManager, syncCategoriesToExtensionStorage } from '../utils/database';
import { p2pSyncManager } from '../utils/p2pSyncManager';
import { getCategoryIconComponent } from '../utils/categoryIcons';

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
  const [categories, setCategories] = useState<LogCategoryConfig[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [autofillToast, setAutofillToast] = useState<string | null>(null);

  // Listen for Reservation DOM Script Runner Autofill Messages
  useEffect(() => {
    const handleAutofillMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'FRONTDESK_AUTOFILL_LOG' && event.data.data) {
        const d = event.data.data;
        if (d.category) setActiveCategory(d.category);
        if (d.name) setName(d.name);
        if (d.phoneNumber || d.phone) setPhone(d.phoneNumber || d.phone);
        if (d.email) setEmail(d.email);
        if (d.roomNumber) setRoomNumber(d.roomNumber);
        if (d.reservationNumber) setReservationNumber(d.reservationNumber);
        if (d.topic) setTopic(d.topic);
        if (d.subCategory) setSubCategory(d.subCategory);
        if (d.clerkNotes) setClerkNotes(d.clerkNotes);
        if (d.customFields) setCustomFieldValues(d.customFields);
        if (!isOpen) onToggle();
        setAutofillToast('Autofilled from Reservation Page DOM Script!');
        setTimeout(() => setAutofillToast(null), 4000);
      }
    };

    window.addEventListener('message', handleAutofillMessage);
    return () => window.removeEventListener('message', handleAutofillMessage);
  }, [isOpen, onToggle]);

  // Load categories and settings from DB and subscribe to peer sync
  useEffect(() => {
    const loadCategoriesAndSettings = async () => {
      try {
        const [cats, appSettings] = await Promise.all([
          db.getCategories(),
          db.getSettings(),
        ]);
        if (cats && cats.length > 0) {
          setCategories(cats);
          syncCategoriesToExtensionStorage(cats);
        }
        if (appSettings) {
          setSettings(appSettings);
        }
      } catch (err) {
        console.error('Failed to load extension bubble data:', err);
      }
    };

    loadCategoriesAndSettings();

    const unsubscribe = p2pSyncManager.subscribeData(() => {
      loadCategoriesAndSettings();
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen]);

  const currentCategoryConfig = useMemo(() => {
    return categories.find((c) => c.name.toLowerCase() === activeCategory.toLowerCase());
  }, [categories, activeCategory]);

  const currentCategoryQuestionnaire = useMemo(() => {
    if (currentCategoryConfig?.questionnaire && currentCategoryConfig.questionnaire.length > 0) {
      return currentCategoryConfig.questionnaire;
    }
    return getDefaultQuestionnaireForCategory(activeCategory);
  }, [currentCategoryConfig, activeCategory]);

  const isFieldRequired = (key: string, defaultRequired: boolean = false): boolean => {
    const item = currentCategoryQuestionnaire.find((q) => q.id === key);
    if (item) {
      return item.enabled !== false && item.required;
    }
    return defaultRequired;
  };

  const isFieldEnabled = (key: string, defaultEnabled: boolean = true): boolean => {
    const item = currentCategoryQuestionnaire.find((q) => q.id === key);
    if (item) {
      return item.enabled !== false;
    }
    return defaultEnabled;
  };

  const getFieldLabel = (key: string, defaultLabel: string): string => {
    const item = currentCategoryQuestionnaire.find((q) => q.id === key);
    return item?.label || defaultLabel;
  };

  const standardQuestionIds = useMemo(() => new Set([
    'guestName', 'phoneNumber', 'email', 'roomRequirement', 'dates',
    'clerkNotes', 'reminder', 'roomNumber', 'reservationNumber', 'topic', 'subCategory'
  ]), []);

  const customQuestions = useMemo(() => {
    return currentCategoryQuestionnaire.filter((q) => !standardQuestionIds.has(q.id) && q.enabled !== false);
  }, [currentCategoryQuestionnaire, standardQuestionIds]);

  const activeSubcategories = useMemo(() => {
    if (currentCategoryConfig?.subcategories && currentCategoryConfig.subcategories.length > 0) {
      return currentCategoryConfig.subcategories;
    }
    if (activeCategory === 'Sales') return ['Group', 'Wedding', 'Sports team', 'Company', 'Other'];
    if (activeCategory === 'Complaint') return ['Room Maintenance', 'Noise / Disturbance', 'Billing & Folio', 'Housekeeping / Cleanliness', 'Staff / Service', 'Other'];
    return ['General', 'Maintenance', 'Shift Handover', 'Front Desk', 'Other'];
  }, [currentCategoryConfig, activeCategory]);

  // Movable Bubble State
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const bubbleStartRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  const currentPosRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize position from localStorage or default to bottom-right
  useEffect(() => {
    try {
      const saved = localStorage.getItem('fdp_bubble_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          const clampedX = Math.max(12, Math.min(window.innerWidth - 60, parsed.x));
          const clampedY = Math.max(12, Math.min(window.innerHeight - 60, parsed.y));
          setPosition({ x: clampedX, y: clampedY });
          currentPosRef.current = { x: clampedX, y: clampedY };
          return;
        }
      }
    } catch {
      // ignore
    }
    const defaultX = window.innerWidth - 72;
    const defaultY = window.innerHeight - 72;
    setPosition({ x: defaultX, y: defaultY });
    currentPosRef.current = { x: defaultX, y: defaultY };
  }, []);

  // Handle window resize clamping
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        if (!prev) return prev;
        const clampedX = Math.max(12, Math.min(window.innerWidth - 60, prev.x));
        const clampedY = Math.max(12, Math.min(window.innerHeight - 60, prev.y));
        currentPosRef.current = { x: clampedX, y: clampedY };
        return { x: clampedX, y: clampedY };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    bubbleStartRef.current = currentPosRef.current || {
      x: window.innerWidth - 72,
      y: window.innerHeight - 72,
    };

    const handlePointerMove = (ev: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = ev.clientX - dragStartRef.current.x;
      const dy = ev.clientY - dragStartRef.current.y;
      if (Math.hypot(dx, dy) > 4) {
        hasMovedRef.current = true;
        setIsDragging(true);
        const newX = Math.max(12, Math.min(window.innerWidth - 60, bubbleStartRef.current.x + dx));
        const newY = Math.max(12, Math.min(window.innerHeight - 60, bubbleStartRef.current.y + dy));
        const nextPos = { x: newX, y: newY };
        currentPosRef.current = nextPos;
        setPosition(nextPos);
      }
    };

    const handlePointerUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);

      if (hasMovedRef.current) {
        if (currentPosRef.current) {
          try {
            localStorage.setItem('fdp_bubble_pos', JSON.stringify(currentPosRef.current));
          } catch {
            // ignore
          }
        }
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleButtonClick = () => {
    if (!hasMovedRef.current) {
      onToggle();
    }
  };

  const triggerStyle = useMemo<React.CSSProperties | undefined>(() => {
    if (!position) return undefined;
    return {
      left: `${position.x}px`,
      top: `${position.y}px`,
      right: 'auto',
      bottom: 'auto',
      cursor: isDragging ? 'grabbing' : 'grab',
      touchAction: 'none',
      userSelect: 'none',
    };
  }, [position, isDragging]);

  const modalStyle = useMemo<React.CSSProperties | undefined>(() => {
    if (!position) return undefined;
    const isBottomHalf = position.y > (typeof window !== 'undefined' ? window.innerHeight / 2 : 400);
    const isRightHalf = position.x > (typeof window !== 'undefined' ? window.innerWidth / 2 : 500);

    const style: React.CSSProperties = {};

    if (isBottomHalf) {
      style.bottom = `${window.innerHeight - position.y + 12}px`;
      style.top = 'auto';
    } else {
      style.top = `${position.y + 56}px`;
      style.bottom = 'auto';
    }

    if (isRightHalf) {
      style.right = `${Math.max(16, window.innerWidth - position.x - 48)}px`;
      style.left = 'auto';
    } else {
      style.left = `${Math.max(16, position.x)}px`;
      style.right = 'auto';
    }

    return style;
  }, [position]);

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
        topic: topic.trim() || `${activeCategory} Log`,
        subCategory,
        name: name.trim() || undefined,
        phoneNumber: phone.trim() || undefined,
        roomNumber: roomNumber.trim() || undefined,
      };
    }

    if (Object.keys(customFieldValues).length > 0) {
      entry.customFields = customFieldValues;
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
      {/* Floating Trigger Button (Movable Anywhere on Screen — Free Floating Animated Log Book) */}
      <button
        id="fdp-inapp-bubble"
        data-fdp-inapp-bubble="true"
        type="button"
        onPointerDown={handlePointerDown}
        onClick={handleButtonClick}
        style={triggerStyle}
        title="FrontDesk Pro — Floating Shift Log Book (Drag to move anywhere)"
        className={`group fixed ${!position ? 'bottom-6 right-6' : ''} p-0 bg-transparent hover:scale-105 active:scale-95 text-white flex items-center justify-center transition-all duration-200 z-50 select-none drop-shadow-2xl ${
          isDragging ? 'cursor-grabbing scale-105 rotate-3' : 'cursor-grab animate-logbook-float'
        } ${isOpen ? 'book-open' : ''}`}
      >
        <svg
          viewBox="0 0 44 48"
          className="w-12 h-13 pointer-events-none logbook-stack-3d transition-transform duration-300"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle Ground Shadow */}
          <ellipse cx="22" cy="45" rx="14" ry="2" fill="rgba(0,0,0,0.35)" />

          {/* Book Back Cover & Page Block */}
          <rect x="7" y="5" width="31" height="37" rx="3" fill="#0b1120" />
          {/* Stacked Ivory Pages with subtle ruled edge */}
          <rect x="9" y="6" width="30" height="35" rx="2" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="0.75" />
          <line x1="36" y1="9" x2="36" y2="38" stroke="#94a3b8" strokeWidth="0.75" strokeDasharray="1.5 1.5" />
          <line x1="37.5" y1="10" x2="37.5" y2="37" stroke="#cbd5e1" strokeWidth="0.5" />

          {/* Interior Ruled Page Details (visible when cover opens on hover) */}
          <line x1="14" y1="13" x2="32" y2="13" stroke="#60a5fa" strokeWidth="1" strokeLinecap="round" />
          <line x1="14" y1="18" x2="30" y2="18" stroke="#94a3b8" strokeWidth="0.75" strokeLinecap="round" />
          <line x1="14" y1="23" x2="32" y2="23" stroke="#94a3b8" strokeWidth="0.75" strokeLinecap="round" />
          <line x1="14" y1="28" x2="28" y2="28" stroke="#94a3b8" strokeWidth="0.75" strokeLinecap="round" />
          <line x1="14" y1="33" x2="31" y2="33" stroke="#94a3b8" strokeWidth="0.75" strokeLinecap="round" />

          {/* Silk Bookmark Ribbon with flutter animation */}
          <path
            d="M17 24 L17 44 L20 41.5 L23 44 L23 24 Z"
            fill="#10b981"
            className="animate-ribbon-wave"
          />

          {/* 3D Animated Front Cover (opens on hover and opens wide when form is open) */}
          <g className="logbook-cover-3d">
            {/* Front Leather Cover */}
            <rect x="5" y="4" width="32" height="39" rx="3.5" fill="url(#inapp-logbook-leather)" stroke="#334155" strokeWidth="0.8" />

            {/* Bound Leather Spine */}
            <path d="M5 4 H10.5 V43 H5 A2.5 2.5 0 0 1 5 4 Z" fill="#090d16" />

            {/* Gold Spine Ribs / Stitching Bands */}
            <line x1="6.5" y1="11" x2="9.5" y2="11" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="6.5" y1="23.5" x2="9.5" y2="23.5" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="6.5" y1="36" x2="9.5" y2="36" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round" />

            {/* Debossed Gold/Navy Ledger Label Plate */}
            <rect x="13.5" y="12" width="18" height="15" rx="2" fill="#0f172a" stroke="#f59e0b" strokeWidth="0.75" />
            {/* Front Desk Shift Log Header Icon / Emblem with Blinking Text Lines */}
            <line x1="16" y1="16" x2="28" y2="16" stroke="#38bdf8" strokeWidth="1.2" strokeLinecap="round" className="animate-book-text-blink" />
            <line x1="16" y1="19.5" x2="25.5" y2="19.5" stroke="#f1f5f9" strokeWidth="1" strokeLinecap="round" className="animate-book-text-blink" style={{ animationDelay: '300ms' }} />
            <line x1="16" y1="23" x2="27" y2="23" stroke="#94a3b8" strokeWidth="0.8" strokeLinecap="round" className="animate-book-text-blink" style={{ animationDelay: '600ms' }} />

            {/* Metal Corner Accent Protectors */}
            <path d="M33 4.5 L36.5 4.5 L36.5 8 Z" fill="#94a3b8" opacity="0.6" />
            <path d="M33 42.5 L36.5 42.5 L36.5 39 Z" fill="#94a3b8" opacity="0.6" />
          </g>

          <defs>
            <linearGradient id="inapp-logbook-leather" x1="5" y1="4" x2="37" y2="43" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="45%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#090d16" />
            </linearGradient>
          </defs>
        </svg>
      </button>

      {/* Floating Modal Panel (Emerges smoothly from Open Book) */}
      {isOpen && (
        <div 
          style={modalStyle}
          className={`fixed ${!position ? 'bottom-20 right-6' : ''} w-96 max-w-[calc(100vw-32px)] max-h-[calc(100vh-120px)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col animate-in zoom-in-75 fade-in duration-200 origin-bottom-right`}
        >
          {/* Header */}
          <div className="bg-slate-900 text-white p-3 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center space-x-2.5">
              <img src="/favicon.png" alt="FrontDesk Pro" className="w-5 h-5 rounded-md object-cover shadow-xs" />
              <div>
                <h4 className="text-sm font-black tracking-tight text-white flex items-center">
                  FrontDesk&nbsp;<span className="text-blue-400">Pro</span>
                  <span className="text-slate-400 font-normal text-xs ml-1.5">— Quick Log</span>
                </h4>
                <p className="text-[10px] text-slate-400">Shift Notes, Complaints & Lead Capture</p>
              </div>
            </div>
            <button
              onClick={onToggle}
              className="text-slate-400 hover:text-white p-1 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Autofill Notification Banner */}
          {autofillToast && (
            <div className="bg-emerald-600 text-white px-3 py-1.5 text-xs font-semibold flex items-center space-x-1.5 animate-in fade-in">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>{autofillToast}</span>
            </div>
          )}

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
              {/* Category Tabs (Dynamically Synced with Manager Created Categories) */}
              <div className="flex p-1 m-3 bg-gray-100 dark:bg-gray-800 rounded-xl gap-1 text-xs overflow-x-auto no-scrollbar">
                {(categories.length > 0 ? categories : [
                  { id: 'cat_sales', name: 'Sales', icon: 'Building2' },
                  { id: 'cat_complaint', name: 'Complaint', icon: 'AlertTriangle' },
                  { id: 'cat_misc', name: 'Miscellaneous', icon: 'Tag' }
                ]).map((cat) => {
                  const isSelected = activeCategory.toLowerCase() === cat.name.toLowerCase();
                  const IconComp = getCategoryIconComponent(cat.icon);
                  return (
                    <button
                      key={cat.id || cat.name}
                      type="button"
                      onClick={() => {
                        setActiveCategory(cat.name);
                        if (cat.subcategories && cat.subcategories.length > 0) {
                          setSubCategory(cat.subcategories[0]);
                        }
                      }}
                      className={`flex-1 min-w-[72px] py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center space-x-1 whitespace-nowrap transition cursor-pointer ${
                        isSelected 
                          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs' 
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <IconComp className={`w-3.5 h-3.5 shrink-0 ${
                        cat.name === 'Sales' ? 'text-emerald-600' : cat.name === 'Complaint' ? 'text-rose-600' : 'text-indigo-600'
                      }`} />
                      <span className="truncate">{cat.name}</span>
                    </button>
                  );
                })}
              </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-3.5 pt-0 overflow-y-auto space-y-2.5 text-xs flex-1">
            {/* SALES FIELDS */}
            {activeCategory === 'Sales' && (
              <>
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">
                    {getFieldLabel('subCategory', 'Subcategory')} {isFieldRequired('subCategory', true) ? '*' : '(Optional)'}
                  </label>
                  <select
                    value={subCategory}
                    onChange={(e) => setSubCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {activeSubcategories.map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1">
                    {getFieldLabel('guestName', 'Lead / Contact Name')} {isFieldRequired('guestName', true) ? '*' : '(Optional)'}
                  </label>
                  <input
                    type="text"
                    required={isFieldRequired('guestName', true)}
                    placeholder="e.g. Acme Tech Conference"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">
                      {getFieldLabel('phoneNumber', 'Phone')} {isFieldRequired('phoneNumber', true) ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="text"
                      required={isFieldRequired('phoneNumber', true)}
                      placeholder="(555) 000-0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">
                      {getFieldLabel('email', 'Email')} {isFieldRequired('email', false) ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="email"
                      required={isFieldRequired('email', false)}
                      placeholder="name@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">
                      Target Check-In {isFieldRequired('dates', false) ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="date"
                      required={isFieldRequired('dates', false)}
                      value={checkInDate}
                      onChange={(e) => setCheckInDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">
                      Target Check-Out {isFieldRequired('dates', false) ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="date"
                      required={isFieldRequired('dates', false)}
                      value={checkOutDate}
                      onChange={(e) => setCheckOutDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">
                      {getFieldLabel('roomRequirement', 'Rooms')} {isFieldRequired('roomRequirement', true) ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      required={isFieldRequired('roomRequirement', true)}
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
                  <label className="font-semibold text-gray-700 block mb-1">
                    {getFieldLabel('subCategory', 'Issue Type')} {isFieldRequired('subCategory', true) ? '*' : '(Optional)'}
                  </label>
                  <select
                    value={subCategory}
                    onChange={(e) => setSubCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 mb-2"
                  >
                    {activeSubcategories.map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1">
                    {getFieldLabel('guestName', 'Guest Name')} {isFieldRequired('guestName', true) ? '*' : '(Optional)'}
                  </label>
                  <input
                    type="text"
                    required={isFieldRequired('guestName', true)}
                    placeholder="Guest Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">
                      {getFieldLabel('phoneNumber', 'Phone')} {isFieldRequired('phoneNumber', true) ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="text"
                      required={isFieldRequired('phoneNumber', true)}
                      placeholder="(555) 000-0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">
                      {getFieldLabel('roomNumber', 'Room #')} {isFieldRequired('roomNumber', false) ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="text"
                      required={isFieldRequired('roomNumber', false)}
                      placeholder="e.g. 214"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1">
                    {getFieldLabel('reservationNumber', 'Reservation #')} {isFieldRequired('reservationNumber', false) ? '*' : '(Optional)'}
                  </label>
                  <input
                    type="text"
                    required={isFieldRequired('reservationNumber', false)}
                    placeholder="e.g. RES-49102"
                    value={reservationNumber}
                    onChange={(e) => setReservationNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            {/* CUSTOM CATEGORY OR MISCELLANEOUS FIELDS */}
            {activeCategory !== 'Sales' && activeCategory !== 'Complaint' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">
                      {getFieldLabel('topic', 'Topic / Subject')} {isFieldRequired('topic', false) ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="text"
                      required={isFieldRequired('topic', false)}
                      placeholder={`e.g. ${activeCategory} note`}
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">
                      {getFieldLabel('subCategory', 'Subcategory')} {isFieldRequired('subCategory', true) ? '*' : '(Optional)'}
                    </label>
                    <select
                      value={subCategory}
                      onChange={(e) => setSubCategory(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {activeSubcategories.map((sub) => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">
                      {getFieldLabel('guestName', 'Contact / Guest')} {isFieldRequired('guestName', false) ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="text"
                      required={isFieldRequired('guestName', false)}
                      placeholder="e.g. Staff or guest"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">
                      {getFieldLabel('roomNumber', 'Room #')} {isFieldRequired('roomNumber', false) ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="text"
                      required={isFieldRequired('roomNumber', false)}
                      placeholder="e.g. 102"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Custom Category Questionnaire Questions */}
            {customQuestions.length > 0 && (
              <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 block">
                  Additional Fields ({customQuestions.length})
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {customQuestions.map((q) => (
                    <div key={q.id}>
                      <label className="font-semibold text-gray-700 block mb-1 text-[11px] truncate">
                        {q.label} {q.required ? <span className="text-rose-500 font-bold">*</span> : <span className="text-gray-400 font-normal text-[10px]">(Opt)</span>}
                      </label>
                      <input
                        type="text"
                        required={q.required}
                        placeholder={`Enter ${q.label}...`}
                        value={customFieldValues[q.id] || ''}
                        onChange={(e) => setCustomFieldValues({ ...customFieldValues, [q.id]: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="font-semibold text-gray-700 block mb-1">
                {getFieldLabel('clerkNotes', 'Clerk Notes / Context')} {isFieldRequired('clerkNotes', false) ? '*' : '(Optional)'}
              </label>
              <textarea
                rows={2}
                required={isFieldRequired('clerkNotes', false)}
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
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2 rounded-lg text-center font-medium text-xs animate-in fade-in">
                Shift log recorded and synced to register
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
