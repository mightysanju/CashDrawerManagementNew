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

export interface LogCategoryConfig {
  id: string;
  name: PrimaryCategory;
  subcategories: string[];
  rateMultiplier?: number;
}

export type SalesLeadStatus = 
  | 'New Lead' 
  | 'Processing' 
  | 'Tentative / Contract Sent' 
  | 'Closed Definite' 
  | 'Lost';

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
 *  System Settings
 * ------------------------------------------------------------- */
export interface AppSettings {
  id: string;
  salesRateMultiplier: number; // Default multiplier for potential revenue (e.g. $120.00)
  organizationName: string;
  maxOpenDrawers?: number; // Maximum simultaneous open cash drawers allowed across the property (Default: 1)
  databaseEpoch?: number; // Unique timestamp of database creation/reset to prevent resurrected deleted databases
  databaseId?: string; // Unique database ID
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
