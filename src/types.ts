export interface CashEntry {
  type: 'bill' | 'coin' | 'roll' | 'receipt';
  denomination: number;
  quantity: number;
  total: number;
}

export interface ShiftRecord {
  id: string;
  organizationName?: string;
  drawerNumber: string;
  cashierName: string;
  cashierId?: string;
  openTime: string;
  closeTime?: string;
  openingBalance: number;
  closingBalance?: number;
  shiftDrop?: number;
  entries: CashEntry[];
  status: 'open' | 'closed';
  isSelected?: boolean;
  closingNotes?: string;
  handoverNotes?: string;
}

export interface DrawerState {
  currentShift: ShiftRecord | null;
  shiftHistory: ShiftRecord[];
  organizationName: string;
  drawerNumber: string;
  cashierName: string;
}

/* -------------------------------------------------------------
 *  User Accounts & Role-Based Access Control (RBAC)
 * ------------------------------------------------------------- */
export type UserRole = 'manager' | 'clerk';

export interface UserAccount {
  id: string;
  username: string;
  passwordHash: string; // Plaintext or hash for local authentication
  fullName: string;
  role: UserRole;
  createdAt: string;
  isActive: boolean;
}

/* -------------------------------------------------------------
 *  Shift Log Management, Categories & Sales Leads
 * ------------------------------------------------------------- */
export type PrimaryCategory = 'Sales' | 'Complaint' | 'Miscellaneous' | string;

export interface CategoryQuestionItem {
  id: string; // 'guestName' | 'phoneNumber' | 'email' | 'roomNumber' | 'reservationNumber' | 'dates' | 'roomRequirement' | 'topic' | 'clerkNotes' | 'reminder' | string
  label: string;
  required: boolean; // toggle: true = Required (*), false = Optional
  enabled: boolean;  // toggle: true = include in form, false = hidden
}

export interface LogCategoryConfig {
  id: string;
  name: PrimaryCategory;
  subcategories: string[];
  rateMultiplier?: number;
  icon?: string;
  color?: string;
  questionnaire?: CategoryQuestionItem[];
}

export function getDefaultQuestionnaireForCategory(categoryName: string): CategoryQuestionItem[] {
  const norm = (categoryName || '').toLowerCase().trim();
  if (norm === 'sales') {
    return [
      { id: 'guestName', label: 'Name (Organizer/Guest)', required: true, enabled: true },
      { id: 'phoneNumber', label: 'Phone Number', required: true, enabled: true },
      { id: 'email', label: 'Email Address', required: false, enabled: true },
      { id: 'roomRequirement', label: 'Room Requirement', required: true, enabled: true },
      { id: 'dates', label: 'Stay Duration Dates', required: true, enabled: true },
      { id: 'clerkNotes', label: 'Clerk Notes / Deal Terms', required: true, enabled: true },
      { id: 'reminder', label: 'Follow-up Reminder Date', required: false, enabled: true },
    ];
  }
  if (norm === 'complaint') {
    return [
      { id: 'guestName', label: 'Guest Name', required: true, enabled: true },
      { id: 'phoneNumber', label: 'Phone Number', required: true, enabled: true },
      { id: 'roomNumber', label: 'Room Number', required: false, enabled: true },
      { id: 'reservationNumber', label: 'Reservation / Folio #', required: false, enabled: true },
      { id: 'clerkNotes', label: 'Complaint Details / Notes', required: true, enabled: true },
      { id: 'reminder', label: 'Follow-up Reminder Date', required: false, enabled: true },
    ];
  }
  if (norm === 'miscellaneous') {
    return [
      { id: 'topic', label: 'Topic / Subject', required: true, enabled: true },
      { id: 'guestName', label: 'Contact / Guest Name', required: false, enabled: true },
      { id: 'phoneNumber', label: 'Phone Number', required: false, enabled: true },
      { id: 'roomNumber', label: 'Room Number', required: false, enabled: true },
      { id: 'clerkNotes', label: 'Shift Handover Notes', required: true, enabled: true },
      { id: 'reminder', label: 'Follow-up Reminder Date', required: false, enabled: true },
    ];
  }
  // Default for custom categories (Maintenance, Housekeeping, IT, etc.)
  return [
    { id: 'topic', label: 'Task / Item Summary', required: true, enabled: true },
    { id: 'roomNumber', label: 'Room / Area', required: false, enabled: true },
    { id: 'guestName', label: 'Staff / Guest Contact', required: false, enabled: true },
    { id: 'phoneNumber', label: 'Phone Number', required: false, enabled: true },
    { id: 'clerkNotes', label: 'Details / Observations', required: true, enabled: true },
    { id: 'reminder', label: 'Follow-up Due Date', required: false, enabled: true },
  ];
}

export type SalesLeadStatus = 
  | 'New Lead' 
  | 'Processing' 
  | 'Tentative / Contract Sent' 
  | 'Closed Definite' 
  | 'Lost';

export interface RoomBookingItem {
  id: string;
  roomType: string;
  roomCount: number;
  offeredRate: number;
}

export type ComplaintStatus = 'Open' | 'In Progress' | 'Resolved';

export interface ShiftLogEntry {
  id: string;
  shiftId?: string; // Associated shift ID
  drawerNumber?: string;
  clerkId: string;
  clerkName: string;
  createdAt: string;
  updatedAt?: string;

  // Categorization
  category: PrimaryCategory; // 'Sales' | 'Complaint' | 'Miscellaneous' | custom
  subCategory?: string; // 'Group' | 'Wedding' | 'Sports team' | 'Company' | etc.

  // Mandatory for Sales; Mandatory for Complaint; Optional for Misc
  name?: string; // Guest or Group/Organizer Name
  phoneNumber?: string;

  // Sales-Specific Fields
  email?: string;
  roomRequirement?: number; // Number of rooms needed
  checkInDate?: string; // YYYY-MM-DD
  checkOutDate?: string; // YYYY-MM-DD
  totalRoomNights?: number; // Auto-generated: roomRequirement * (nights)
  potentialRevenue?: number; // Auto-generated: totalRoomNights * rateMultiplier
  salesStatus?: SalesLeadStatus;
  roomBookings?: RoomBookingItem[]; // Multi-row room breakdown when Closed Definite
  actualClosedRevenue?: number; // Actual revenue calculated: sum(rooms * nights * offeredRate)

  // Complaint-Specific Fields
  reservationNumber?: string;
  roomNumber?: string;
  complaintStatus?: ComplaintStatus;

  // Miscellaneous-Specific Fields
  topic?: string;

  // Universal Clerk Notes
  clerkNotes?: string;

  // Reminders Feature
  hasReminder?: boolean;
  reminderDate?: string; // YYYY-MM-DD or ISO
  reminderNote?: string;
  isReminderCompleted?: boolean;

  // Threaded Responses / Replies
  responses?: ShiftLogResponse[];

  // Dynamic Custom Questionnaire Fields
  customFields?: Record<string, string>;
}

export interface ShiftLogResponse {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  message: string;
  createdAt: string;
}

/* -------------------------------------------------------------
 *  System Settings & Form Questionnaire Customization
 * ------------------------------------------------------------- */
export type FormFieldKey = 
  | 'guestName'
  | 'phoneNumber'
  | 'email'
  | 'subCategory'
  | 'roomNumber'
  | 'reservationNumber'
  | 'dates'
  | 'roomRequirement'
  | 'topic'
  | 'clerkNotes'
  | 'reminder';

export interface FormFieldSetting {
  label: string;
  enabled: boolean;
  required: boolean;
  description?: string;
  categoryScope?: 'all' | 'sales' | 'complaint' | 'notes';
}

export type FormFieldSettingsMap = Partial<Record<FormFieldKey, FormFieldSetting>>;

export const DEFAULT_FORM_FIELD_SETTINGS: Record<FormFieldKey, FormFieldSetting> = {
  guestName: {
    label: 'Guest / Organizer Name',
    enabled: true,
    required: true,
    description: 'Name of the organizer, guest, or caller',
    categoryScope: 'all',
  },
  phoneNumber: {
    label: 'Phone Number',
    enabled: true,
    required: true,
    description: 'Contact phone number for callbacks and SMS follow-ups',
    categoryScope: 'all',
  },
  email: {
    label: 'Email Address',
    enabled: true,
    required: false,
    description: 'Email for quotes, contracts, or written responses',
    categoryScope: 'sales',
  },
  subCategory: {
    label: 'Subcategory / Classification',
    enabled: true,
    required: true,
    description: 'Type classification (Group, Wedding, Noise, Maintenance, etc.)',
    categoryScope: 'all',
  },
  roomNumber: {
    label: 'Room Number',
    enabled: true,
    required: false,
    description: 'Associated guest room number if applicable',
    categoryScope: 'complaint',
  },
  reservationNumber: {
    label: 'Reservation / Folio #',
    enabled: true,
    required: false,
    description: 'PMS confirmation or folio reservation ID',
    categoryScope: 'complaint',
  },
  dates: {
    label: 'Check-in & Check-out Dates',
    enabled: true,
    required: false,
    description: 'Target stay duration dates for sales pipeline leads',
    categoryScope: 'sales',
  },
  roomRequirement: {
    label: 'Room Count Needed',
    enabled: true,
    required: false,
    description: 'Total guestrooms requested for group booking',
    categoryScope: 'sales',
  },
  topic: {
    label: 'Topic / Title',
    enabled: true,
    required: false,
    description: 'Brief subject headline for shift notes and custom categories',
    categoryScope: 'notes',
  },
  clerkNotes: {
    label: 'Shift Notes & Narrative Details',
    enabled: true,
    required: true,
    description: 'Detailed explanation or handover instructions for team members',
    categoryScope: 'all',
  },
  reminder: {
    label: 'Follow-up Reminder Date',
    enabled: true,
    required: false,
    description: 'Due date and alert reminder for pending shift handovers',
    categoryScope: 'all',
  },
};

export interface AppSettings {
  id: string;
  salesRateMultiplier: number; // Default multiplier for potential revenue (e.g. $120.00)
  organizationName: string;
  maxOpenDrawers?: number; // Maximum simultaneous open cash drawers allowed across the property (Default: 1)
  autoPrintPdfOnClose?: boolean; // Automatically print executive PDF report on shift close (Default: true)
  autoPrintReceiptOnClose?: boolean; // Automatically print receipt on shift close (Default: false)
  lastClosedTillEntries?: CashEntry[]; // Remembered till count breakdown from last closed drawer for next open
  formFieldSettings?: FormFieldSettingsMap; // Questionnaire customization & required/optional toggles
  databaseEpoch?: number; // Unique timestamp of database creation/reset to prevent resurrected deleted databases
  databaseId?: string; // Unique database ID
  isRestoredArchive?: boolean; // Whether database was restored from an archive rather than freshly initialized
  createdBy?: string; // Full name or username of manager who created this database
  createdAt?: string; // ISO timestamp or formatted timestamp of when database was initialized
}

/* -------------------------------------------------------------
 *  Database Archive & Backup
 * ------------------------------------------------------------- */
export interface DatabaseArchive {
  id: string;
  hotelName: string;
  syncGroup: string;
  archivedAt: string;
  archivedBy: string;
  shifts: ShiftRecord[];
  shiftLogs: ShiftLogEntry[];
  categories: LogCategoryConfig[];
  users: UserAccount[];
  settings: AppSettings;
  organization?: { id: string; name: string };
  summary: {
    shiftsCount: number;
    logsCount: number;
    usersCount: number;
    categoriesCount: number;
  };
}
