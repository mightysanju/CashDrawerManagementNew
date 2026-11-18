import React, { useState } from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { AdUnit } from './AdUnit';
import { 
  BookOpen, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  ShieldAlert, 
  CheckCircle2, 
  Calculator, 
  ArrowRight,
  Users,
  Key,
  FolderPlus,
  Kanban,
  FileText,
  Database,
  Wifi,
  Chrome,
  Printer,
  Trash2,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  Receipt,
  Layers
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface FAQItem {
  question: string;
  answer: string;
  category: 'General' | 'Security & Users' | 'Shift Logs & Sales' | 'P2P & Reports' | 'Extension & PMS';
}

const FAQS: FAQItem[] = [
  {
    category: 'General',
    question: "How do I get started with FrontDesk Pro?",
    answer: "Getting started takes less than 60 seconds. Navigate to the app, verify or set your property name (e.g., Grand Hotel & Suites), and open Drawer #1 by entering the verified opening cash float. You can immediately begin logging shifts, tracking cash, managing guest complaints, and recording sales leads."
  },
  {
    category: 'General',
    question: "What is an opening cash float and how much should it be?",
    answer: "An opening float is the fixed starting sum of bills and coins placed into a cash drawer at the start of each shift so the cashier can make change for early transactions. Depending on transaction volume, typical hotel floats range between $100 and $300, weighted heavily toward lower denominations ($1, $5 bills, and quarters)."
  },
  {
    category: 'General',
    question: "What is the standard formula for balancing a cash drawer at end-of-shift?",
    answer: "The universal cash drawer balancing equation is: Expected Cash = Opening Float + Total Cash Sales - Cash Refunds - Cash Drops - Paid-Out Receipts. The Cash Discrepancy (Over/Short) is calculated as: Actual Counted Cash - Expected Cash."
  },
  {
    category: 'Security & Users',
    question: "How do User Accounts and Role-Based Access Control (RBAC) work?",
    answer: "FrontDesk Pro provides two distinct roles: Manager and Clerk. Clerks can count cash, enter shift drops, close shifts, download receipts, and submit shift logs or sales leads. Only Managers can delete logs, delete categories, purge or reset the database, manage staff accounts, and reset user passwords."
  },
  {
    category: 'Security & Users',
    question: "How do I create new staff accounts or reset passwords?",
    answer: "Managers can log in and open the Manager Console by clicking their username badge or the Key icon in the top header, then selecting 'User Management'. Here, managers can click '+ Add New User', set a username and initial password, and assign the Clerk or Manager role. Managers can also click 'Reset to Default' on any user card to instantly reset their password. Clerks can change their own passwords anytime by clicking the Key icon."
  },
  {
    category: 'Shift Logs & Sales',
    question: "How do managers customize shift log categories and questionnaire fields?",
    answer: "Go to Manager Console > Shift Log Categories. Click '+ New Category' to create custom categories (e.g. Sales, Complaints, Maintenance, Lost & Found). You can select custom icons and toggle questionnaire fields between 'Required *' (mandatory submission) and 'Optional'. You can also type dynamic custom questions (e.g., 'Assigned Tech', 'Callback Time') and click '+ Add Question' to attach tailored questions."
  },
  {
    category: 'Shift Logs & Sales',
    question: "Who is allowed to delete guest complaints, shift notes, or sales leads?",
    answer: "Strictly Managers. Clerk accounts cannot delete any logs or audit records. The delete button is conditionally hidden for non-manager accounts and enforced at the database level. Every creation, modification, status change, and deletion is recorded in the immutable Activity Tracker."
  },
  {
    category: 'P2P & Reports',
    question: "Does FrontDesk Pro store company financial data on the cloud?",
    answer: "No. The platform utilizes local IndexedDB browser storage. All shift numbers, cashier names, denomination counts, and reports reside exclusively on your local devices. No financial records are ever transmitted to any third-party or remote servers."
  },
  {
    category: 'P2P & Reports',
    question: "How does the Peer-to-Peer (P2P) LAN sync connect front desk computers without internet?",
    answer: "FrontDesk Pro uses a hybrid WebRTC DataChannel and BroadcastChannel mesh network. As long as front desk computers are on the same local network (Wi-Fi or LAN) and have the same Hotel / Property Name set (e.g., 'Grand Hotel & Suites'), they automatically discover each other and broadcast shift updates, active drawer status, and shift logs in real-time."
  },
  {
    category: 'P2P & Reports',
    question: "What makes the Shift Reconciliation PDF audit report unique?",
    answer: "The executive PDF report automatically renders the verified Hotel / Property Name as the top banner title, followed by 4 compact side-by-side tables for Bills, Coins, Rolls, and Receipts (with Unit, Count, and Total columns). It includes an audit totals strip, shift handover notes, and formal verification signatures for both the Outgoing Cashier and Next Shift Takeover."
  },
  {
    category: 'Extension & PMS',
    question: "How does the FrontDesk Pro Chrome Extension work with Hotel Key PMS?",
    answer: "The extension is specially tailored for Hotel Key PMS (americas.bwh.hkclients.com). It automatically detects when a front desk agent is viewing a guest reservation folio and injects two native in-line buttons: '+ Complaint Log' and '+ Misc Log'. Clicking either button auto-scrapes the guest's name, room number, reservation confirmation number, and folio context directly into the quick-log form in 1 click."
  },
  {
    category: 'Extension & PMS',
    question: "Can I use the floating extension bubble on other web pages?",
    answer: "Yes! While the in-line auto-fetch buttons are exclusive to Hotel Key PMS, the floating book bubble is active across all web tabs. Clicking the book icon slides out the quick-log form so agents can record complaints, maintenance notes, or group sales inquiries from any website."
  }
];

export function CashHandlingGuide() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [activeFaqFilter, setActiveFaqFilter] = useState<string>('All');

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const filteredFaqs = activeFaqFilter === 'All' 
    ? FAQS 
    : FAQS.filter(f => f.category === activeFaqFilter);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 flex flex-col justify-between pt-16 transition-colors">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Hero Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-3">
            <BookOpen size={14} />
            <span>Complete Operations Manual & SOP</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
            FrontDesk Pro Standard Operating Procedures & User Guide
          </h1>
          <p className="text-base md:text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Standard operating procedures (SOP), user administration, drawer reconciliation, sales pipeline tracking, P2P network synchronization, and automated Hotel Key PMS extension integration.
          </p>
        </div>

        {/* AdSense Placement Top */}
        <AdUnit slot="1234567890" format="auto" />

        {/* Quick Jump Navigation Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs mb-10 overflow-x-auto">
          <div className="flex items-center space-x-2 text-xs font-medium whitespace-nowrap min-w-max">
            <span className="text-slate-400 font-bold uppercase tracking-wider px-2">Jump To:</span>
            <a href="#getting-started" className="px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400">1. Getting Started</a>
            <a href="#users-security" className="px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">2. Users & Passwords</a>
            <a href="#categories-questionnaires" className="px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">3. Categories & Questions</a>
            <a href="#sales-pipeline" className="px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">4. Sales Pipeline</a>
            <a href="#complaints-activity" className="px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">5. Complaints & Activity</a>
            <a href="#reports-exports" className="px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">6. Reports & PDF Exports</a>
            <a href="#database-management" className="px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">7. Database & Reset</a>
            <a href="#p2p-sync" className="px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">8. LAN P2P Sync</a>
            <a href="#extension-pms" className="px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold">9. Hotel Key PMS Extension</a>
            <a href="#faq" className="px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">10. FAQ</a>
          </div>
        </div>

        {/* Guide Content Sections */}
        <div className="space-y-12">

          {/* Section 1: Getting Started & Till Counter */}
          <section id="getting-started" className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 p-6 md:p-8">
            <div className="flex items-center space-x-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm">
                1
              </span>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Getting Started: Opening & Balancing the Cash Till
              </h2>
            </div>
            <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
              FrontDesk Pro functions as an executive cash drawer management and front desk operations hub. Follow this procedure for morning shift opening, mid-shift drops, and end-of-shift reconciliation.
            </p>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-lg border border-slate-200 dark:border-slate-700">
                <h4 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center">
                  <CheckCircle2 size={16} className="text-emerald-600 mr-2 shrink-0" />
                  Opening Shift Procedure
                </h4>
                <ol className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-2 list-decimal list-inside">
                  <li>Log in with your Clerk or Manager account credentials.</li>
                  <li>Click <strong>Open Shift</strong> to initiate Drawer #1 (or select your assigned drawer).</li>
                  <li>Count and verify the starting float denominations (standard base: $200.00).</li>
                  <li>Confirm the Opening Balance. The register status switches to <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Drawer #1 Active</span>.</li>
                </ol>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-lg border border-slate-200 dark:border-slate-700">
                <h4 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center">
                  <Calculator size={16} className="text-blue-600 mr-2 shrink-0" />
                  Mid-Shift Drop & Closing Till Sequence
                </h4>
                <ol className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-2 list-decimal list-inside">
                  <li><strong>Shift Drops (Cash Skims):</strong> When large notes ($50/$100) accumulate, record a <em>Safe Drop</em> amount, place cash in the drop envelope, and deposit into the safe.</li>
                  <li><strong>Paid-Out Receipts:</strong> Enter any petty cash payouts or vendor vouchers in the <em>Receipts</em> section.</li>
                  <li><strong>Closing Count:</strong> At shift handover, count physical Bills, Coins, and Rolls. The system instantly computes <span className="font-semibold text-slate-900 dark:text-white">Variance (Over / Short / Balanced)</span>.</li>
                </ol>
              </div>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border-l-4 border-blue-600 rounded-r-lg">
              <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">Standard Balancing Formula:</h4>
              <p className="font-mono text-xs sm:text-sm text-blue-800 dark:text-blue-300">
                Expected Cash = Starting Float + Cash Intake - Safe Drops - Paid-Out Receipts
              </p>
            </div>
          </section>

          {/* Section 2: User Accounts, Roles & Password Resets */}
          <section id="users-security" className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 p-6 md:p-8">
            <div className="flex items-center space-x-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-sm">
                2
              </span>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users size={22} className="text-indigo-600" />
                User Management, Role-Based Access & Password Resets
              </h2>
            </div>
            <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
              FrontDesk Pro implements local Role-Based Access Control (RBAC) to ensure security and prevent unauthorized record tampering.
            </p>

            <div className="grid md:grid-cols-2 gap-6 items-start mb-6">
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                  <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center">
                    <Key size={16} className="text-indigo-600 mr-2 shrink-0" />
                    Roles & Privileges
                  </h4>
                  <ul className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-2">
                    <li>
                      <strong className="text-slate-900 dark:text-white">Clerk:</strong> Designed for front desk staff. Can count drawers, record drops, close shifts, download receipts, and create logs or sales leads. Cannot delete records or access manager admin tools.
                    </li>
                    <li>
                      <strong className="text-slate-900 dark:text-white">Manager:</strong> Full supervisory control. Granted permission to delete logs, purge databases, manage users, create custom categories, and reset passwords.
                    </li>
                  </ul>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                  <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center">
                    <RefreshCw size={16} className="text-emerald-600 mr-2 shrink-0" />
                    How to Reset Passwords
                  </h4>
                  <ol className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-1.5 list-decimal list-inside">
                    <li><strong>Clerk Self-Reset:</strong> Any logged-in user can click the Key icon in the header next to their username badge to change their password.</li>
                    <li><strong>Manager Admin Reset:</strong> Managers open <em>Manager Console &gt; User Management</em> and click <strong>Reset to Default</strong> on any staff member's profile card to instantly reset their password to the property default.</li>
                    <li><strong>Automatic Sign-Out Cleanup:</strong> When a user clicks Sign Out, all username and password input fields are cleared automatically for privacy.</li>
                  </ol>
                </div>
              </div>

              <div className="space-y-3">
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs bg-slate-100 dark:bg-slate-800 p-2">
                  <img 
                    src="/guide-assets/login-modal.png" 
                    alt="FrontDesk Pro Staff Login and Role Switcher" 
                    className="w-full h-auto rounded-lg object-cover"
                  />
                  <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 mt-2 font-medium">
                    Figure 1: FrontDesk Pro secure login modal with role authentication and session management.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Categories & Custom Questionnaires */}
          <section id="categories-questionnaires" className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 p-6 md:p-8">
            <div className="flex items-center space-x-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm">
                3
              </span>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FolderPlus size={22} className="text-blue-600" />
                Custom Categories & Dynamic Questionnaires
              </h2>
            </div>
            <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
              Every hotel has unique workflows. FrontDesk Pro allows managers to define custom categories, customize icons, and configure dynamic questionnaire prompts that automatically appear in the in-app modal and browser extension.
            </p>

            <div className="grid md:grid-cols-2 gap-6 items-center mb-6">
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs bg-slate-100 dark:bg-slate-800 p-2">
                <img 
                  src="/guide-assets/category-management.png" 
                  alt="FrontDesk Pro Shift Log Categories & Questionnaire Management" 
                  className="w-full h-auto rounded-lg object-cover"
                />
                <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 mt-2 font-medium">
                  Figure 2: Manager category builder with custom icons and Required * / Optional toggles (guest identity blurred for privacy).
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Creating Categories & Setting Icons:</h4>
                  <ul className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-2">
                    <li>• Click <strong>Manager Console &gt; Shift Log Categories</strong>.</li>
                    <li>• Click <strong>+ New Category</strong> to create categories such as <em>Maintenance</em>, <em>Lost &amp; Found</em>, or <em>VIP Concierge</em>.</li>
                    <li>• Select a dedicated icon from the category icon picker (tag, wrench, shield, bell, briefcase, etc.).</li>
                  </ul>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Configuring Dynamic Questions:</h4>
                  <ul className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-1.5">
                    <li>• <strong>Required * Toggle:</strong> Mark essential fields as mandatory to prevent incomplete shift submissions.</li>
                    <li>• <strong>Optional Toggle:</strong> Keep fields available without blocking rapid log entry.</li>
                    <li>• <strong>+ Add Question:</strong> Type any custom prompt (e.g. <em>"Inspected By"</em>, <em>"Follow-up Date"</em>) to dynamically attach tailored questions.</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Sales Pipeline (Kanban) */}
          <section id="sales-pipeline" className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 p-6 md:p-8">
            <div className="flex items-center space-x-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-sm">
                4
              </span>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Kanban size={22} className="text-emerald-600" />
                Group Sales Pipeline & Lead Kanban
              </h2>
            </div>
            <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
              Capture corporate group inquiries, wedding blocks, bus tour leads, and banquet hall rentals directly from the front desk.
            </p>

            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Stage 1</div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">New Inquiries</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Incoming calls or walk-in requests for room blocks and event pricing.</p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">Stage 2</div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">Follow-Up Scheduled</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Date-stamped callback or site tour reminder assigned to oncoming shift.</p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1">Stage 3</div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">Proposal / Quoted</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Formal group rates and contract proposals sent to corporate planner.</p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Stage 4</div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">Closed - Won</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Confirmed booking with deposit paid. Revenue metrics tracked automatically.</p>
              </div>
            </div>

            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border-l-4 border-emerald-600 rounded-r-lg">
              <h4 className="font-semibold text-emerald-900 dark:text-emerald-200 text-sm mb-1">Revenue Tracking & 1-Click Dragging:</h4>
              <p className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-300">
                Front desk agents can record estimated deal values, room night quantities, and planner contacts. Cards can be dragged between pipeline columns or updated via quick status dropdowns.
              </p>
            </div>
          </section>

          {/* Section 5: Complaints Section & Activity Tracker */}
          <section id="complaints-activity" className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 p-6 md:p-8">
            <div className="flex items-center space-x-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-red-600 text-white font-bold text-sm">
                5
              </span>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert size={22} className="text-red-600" />
                Guest Complaints Management & Activity Audit Trail
              </h2>
            </div>
            <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
              Track guest complaints through complete resolution, enforce Manager-only deletion privileges, and maintain an immutable activity log.
            </p>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs bg-slate-100 dark:bg-slate-800 p-2">
                <img 
                  src="/guide-assets/activity-log-cards.png" 
                  alt="FrontDesk Pro Shift Log and Recent Activity Cards" 
                  className="w-full h-auto rounded-lg object-cover"
                />
                <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 mt-2 font-medium">
                  Figure 3: Compact shift log cards with status badges and complete activity tracking.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-900/60">
                  <h4 className="font-bold text-red-900 dark:text-red-200 mb-1 flex items-center">
                    <Trash2 size={16} className="text-red-600 mr-2 shrink-0" />
                    Manager-Only Deletion Policy
                  </h4>
                  <p className="text-xs sm:text-sm text-red-800 dark:text-red-300 leading-relaxed">
                    To maintain strict legal compliance and audit accountability, <strong>only users logged in with the Manager role can delete shift logs, complaints, or categories</strong>. For Clerk accounts, deletion controls are hidden and requests are rejected at the database level.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                  <h4 className="font-bold text-slate-900 dark:text-white mb-2">Complaint Status Progression:</h4>
                  <ul className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-1.5">
                    <li>• <span className="font-semibold text-amber-600 dark:text-amber-400">Pending:</span> Reported by guest, waiting for housekeeping, engineering, or clerk action.</li>
                    <li>• <span className="font-semibold text-blue-600 dark:text-blue-400">In Progress:</span> Maintenance dispatched or guest compensation offered.</li>
                    <li>• <span className="font-semibold text-emerald-600 dark:text-emerald-400">Resolved:</span> Completed and verified with guest sign-off.</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Section 6: Reports & PDF Exports */}
          <section id="reports-exports" className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 p-6 md:p-8">
            <div className="flex items-center space-x-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 dark:bg-slate-700 text-white font-bold text-sm">
                6
              </span>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText size={22} className="text-blue-600" />
                Reports, Receipts & 4-Box Executive PDF Exports
              </h2>
            </div>
            <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
              FrontDesk Pro produces audit-ready documentation for ownership, accounting, and daily shift handovers.
            </p>

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center">
                  <FileText size={16} className="text-blue-600 mr-2 shrink-0" />
                  Shift Reconciliation PDF
                </h4>
                <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <li>• Official Hotel Name in Top Banner</li>
                  <li>• <strong>4 Compact Side-by-Side Boxes:</strong> Bills, Coins, Rolls, Receipts</li>
                  <li>• 3 Columns: <em>Unit | Count | Total</em></li>
                  <li>• Shift Notes &amp; Handover Details</li>
                  <li>• <strong>Outgoing Cashier &amp; Next Shift Takeover Signatures</strong></li>
                </ul>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center">
                  <Printer size={16} className="text-indigo-600 mr-2 shrink-0" />
                  Thermal Receipt Printing
                </h4>
                <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <li>• Compatible with 80mm &amp; 58mm POS receipt printers</li>
                  <li>• Instant thermal slip for safe drop envelope attachment</li>
                  <li>• Cashier sign-off and timestamp lines</li>
                </ul>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center">
                  <Layers size={16} className="text-emerald-600 mr-2 shrink-0" />
                  Audit Logs &amp; CSV Exports
                </h4>
                <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <li>• Date-range filtered Shift Log Audit PDF</li>
                  <li>• Complete Shift History report</li>
                  <li>• Full raw CSV export for Excel &amp; QuickBooks accounting import</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 7: Database Management & Deletion */}
          <section id="database-management" className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 p-6 md:p-8">
            <div className="flex items-center space-x-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-700 text-white font-bold text-sm">
                7
              </span>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Database size={22} className="text-slate-700 dark:text-slate-300" />
                Database Storage, Backups & Safe Deletion
              </h2>
            </div>
            <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
              FrontDesk Pro runs 100% on-device using IndexedDB. No confidential data ever leaves your computer, eliminating cloud subscription costs and internet vulnerability.
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center">
                  <CheckCircle2 size={16} className="text-emerald-600 mr-2 shrink-0" />
                  Database Backups & Archives
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">
                  In <em>Manager Console &gt; Database Operations</em>, click <strong>Create JSON Archive</strong> to instantly download a timestamped snapshot of all shifts, logs, categories, and audit events. Keep weekly backups on your property management hard drive.
                </p>
              </div>

              <div className="p-5 bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-900/60">
                <h4 className="font-bold text-red-900 dark:text-red-200 mb-2 flex items-center">
                  <AlertTriangle size={16} className="text-red-600 mr-2 shrink-0" />
                  Factory Reset & Database Purge
                </h4>
                <p className="text-xs sm:text-sm text-red-800 dark:text-red-300 mb-2 leading-relaxed">
                  Purging the database is strictly restricted to Managers and requires password confirmation. When triggered:
                </p>
                <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
                  <li>• Local shift records, categories, and logs are reset to default factory state.</li>
                  <li>• An epoch purge beacon is broadcasted to all connected LAN registers.</li>
                  <li>• All stored session credentials are wiped cleanly.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 8: Peer-to-Peer (P2P) LAN Synchronization */}
          <section id="p2p-sync" className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 p-6 md:p-8">
            <div className="flex items-center space-x-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-sm">
                8
              </span>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Wifi size={22} className="text-emerald-600" />
                Peer-to-Peer (P2P) Local Network Synchronization
              </h2>
            </div>
            <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
              FrontDesk Pro allows multiple front desk workstations to synchronize drawer balances, handovers, and shift logs across your hotel's local Wi-Fi / LAN without cloud servers.
            </p>

            <div className="grid md:grid-cols-2 gap-6 items-center mb-6">
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-2">How to Establish Connection:</h4>
                  <ol className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-2 list-decimal list-inside">
                    <li>Ensure both front desk computers are connected to the same hotel Wi-Fi or local wired switch.</li>
                    <li>Verify both computers have the same Property / Store name entered (e.g., <strong>Grand Hotel &amp; Suites</strong>).</li>
                    <li>FrontDesk Pro automatically announces presence via LAN broadcast beacons.</li>
                    <li>The status pill in the top header displays <span className="font-semibold text-emerald-600 dark:text-emerald-400">Sync: Grand Hotel &amp; Suites (3 online)</span>.</li>
                  </ol>
                </div>

                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-900/60">
                  <h4 className="font-semibold text-emerald-900 dark:text-emerald-200 mb-1">Zero Cloud Dependency:</h4>
                  <p className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-300">
                    If external internet service goes down, your front desk remains 100% operational. Terminals exchange till counts and shift notes locally through WebRTC DataChannels.
                  </p>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs bg-slate-100 dark:bg-slate-800 p-2">
                <img 
                  src="/guide-assets/header-sync.png" 
                  alt="FrontDesk Pro Header Bar showing LAN Peer Sync and Manager Session" 
                  className="w-full h-auto rounded-lg object-cover"
                />
                <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 mt-2 font-medium">
                  Figure 4: Active P2P network sync showing real-time peer count and manager role.
                </p>
              </div>
            </div>
          </section>

          {/* Section 9: Browser Extension & Hotel Key PMS In-Line Integration */}
          <section id="extension-pms" className="bg-gradient-to-br from-indigo-50/60 to-blue-50/60 dark:from-slate-900 dark:to-indigo-950/30 rounded-xl shadow-xs border-2 border-indigo-200 dark:border-indigo-800/60 p-6 md:p-8">
            <div className="flex items-center space-x-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-sm">
                9
              </span>
              <h2 className="text-2xl font-bold text-indigo-950 dark:text-white flex items-center gap-2">
                <Chrome size={24} className="text-indigo-600 dark:text-indigo-400" />
                FrontDesk Pro Browser Extension & Hotel Key PMS In-Line Integration
              </h2>
            </div>
            <p className="text-slate-700 dark:text-slate-300 mb-6 leading-relaxed">
              The FrontDesk Pro Browser Extension delivers seamless operational workflow by embedding log capture directly inside your Property Management System (PMS).
            </p>

            {/* In-Line Hotel Key PMS Feature Spotlight */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-indigo-200 dark:border-indigo-800 p-5 mb-8 shadow-xs">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm uppercase tracking-wider mb-2">
                <Sparkles size={16} />
                <span>Exclusive Feature: Hotel Key PMS Only In-Line Auto Fetch Details</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Direct In-Line Button Injection on Hotel Key PMS
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                When working inside <strong>Hotel Key PMS</strong> (americas.bwh.hkclients.com), the FrontDesk Pro extension injects two native, styled action buttons: <strong>+ Complaint Log</strong> and <strong>+ Misc Log</strong> directly into the top action bar alongside native PMS folio controls.
              </p>

              <div className="grid md:grid-cols-2 gap-6 items-center mb-4">
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-800 p-2">
                  <img 
                    src="/guide-assets/hotelkey-pms-buttons.png" 
                    alt="In-line Complaint Log and Misc Log buttons injected on Hotel Key PMS" 
                    className="w-full h-auto rounded"
                  />
                  <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 mt-2 font-medium">
                    Figure 5: Native '+ Complaint Log' and '+ Misc Log' buttons injected directly into the Hotel Key PMS top bar.
                  </p>
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-800 p-2">
                  <img 
                    src="/guide-assets/hotelkey-autofill-popup.png" 
                    alt="Auto-captured reservation details inside quick log popup form" 
                    className="w-full h-auto rounded"
                  />
                  <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 mt-2 font-medium">
                    Figure 6: In-screen popup form auto-populated with room and reservation folio (guest name and reservation number blurred for privacy).
                  </p>
                </div>
              </div>

              <div className="bg-indigo-50 dark:bg-indigo-950/50 p-4 rounded-lg border border-indigo-100 dark:border-indigo-900/60">
                <h4 className="font-bold text-indigo-950 dark:text-indigo-200 text-sm mb-1.5 flex items-center">
                  <CheckCircle2 size={16} className="text-indigo-600 mr-2 shrink-0" />
                  How In-Line Auto-Fetch Works in 3 Seconds:
                </h4>
                <ol className="text-xs sm:text-sm text-indigo-900 dark:text-indigo-300 space-y-1.5 list-decimal list-inside">
                  <li>Open any guest reservation or active in-house room folio inside <strong>Hotel Key PMS</strong>.</li>
                  <li>Click either <strong>+ Complaint Log</strong> or <strong>+ Misc Log</strong> in the top header.</li>
                  <li>The extension automatically extracts:
                    <ul className="pl-6 list-disc list-inside text-xs mt-1 text-indigo-800 dark:text-indigo-300">
                      <li><strong>Guest Full Name</strong></li>
                      <li><strong>Room Number</strong></li>
                      <li><strong>Reservation Folio Number</strong></li>
                    </ul>
                  </li>
                  <li>The quick-log form opens pre-filled. Enter your observations and click <strong>Save Shift Log</strong>. No window switching or copy-pasting required!</li>
                </ol>
              </div>
            </div>

            {/* General Floating Bubble Section */}
            <div className="grid md:grid-cols-2 gap-6 items-center">
              <div className="space-y-4">
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                  Universal Floating Book Bubble on Other Websites
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  On web pages outside Hotel Key PMS, the extension provides a compact floating book bubble docked to the right edge of the browser window.
                </p>
                <ul className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-2">
                  <li>• <strong>1-Click Quick Form:</strong> Click the book bubble anytime to slide out the multi-tab log form (Complaint, Shift Note / Miscellaneous, Sales Leads).</li>
                  <li>• <strong>Instant Dynamic Sync:</strong> New categories created in FrontDesk Pro Manager Console sync to the extension immediately.</li>
                  <li>• <strong>Draggable:</strong> Drag the bubble anywhere along the screen to avoid obstructing web content.</li>
                </ul>
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs bg-slate-100 dark:bg-slate-800 p-2">
                <img 
                  src="/guide-assets/extension-log-modal.png" 
                  alt="FrontDesk Pro Quick Log modal dialog with category tabs and fields" 
                  className="w-full h-auto rounded-lg object-cover"
                />
                <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 mt-2 font-medium">
                  Figure 7: Unified Quick Log form with subcategory selector, contact fields, and follow-up reminder.
                </p>
              </div>
            </div>
          </section>

        </div>

        {/* AdSense Placement Middle */}
        <AdUnit slot="0987654321" format="auto" className="my-10" />

        {/* Section 10: Frequently Asked Questions (FAQ) */}
        <div id="faq" className="mt-14 mb-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
              <HelpCircle size={14} />
              <span>Questions & Answers</span>
            </div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
              Frequently Asked Questions (FAQ)
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1 max-w-2xl mx-auto">
              Answers regarding till reconciliation, user administration, Hotel Key PMS integration, and P2P sync.
            </p>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {['All', 'General', 'Security & Users', 'Shift Logs & Sales', 'P2P & Reports', 'Extension & PMS'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveFaqFilter(cat)}
                  className={`px-3 py-1 text-xs rounded-full font-medium transition ${
                    activeFaqFilter === cat 
                      ? 'bg-blue-600 text-white shadow-xs' 
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredFaqs.map((faq, index) => (
              <div
                key={index}
                className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition"
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full text-left px-6 py-4 flex items-center justify-between font-semibold text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition"
                  aria-expanded={openFaqIndex === index}
                >
                  <span className="pr-4 text-sm md:text-base">{faq.question}</span>
                  {openFaqIndex === index ? (
                    <ChevronUp size={20} className="shrink-0 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <ChevronDown size={20} className="shrink-0 text-slate-400" />
                  )}
                </button>
                {openFaqIndex === index && (
                  <div className="px-6 pb-4 pt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Call to action */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white rounded-2xl p-8 text-center mt-12 shadow-md">
          <h3 className="text-2xl md:text-3xl font-bold mb-2">Ready to open your register?</h3>
          <p className="text-blue-100 max-w-xl mx-auto mb-6 text-sm">
            Launch our 100% private in-browser operations hub. Complete till reconciliation, complaints tracking, group sales leads, and Hotel Key PMS integration.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/app"
              className="inline-flex items-center px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition shadow-xs text-sm"
            >
              Open FrontDesk Pro Register <ArrowRight size={18} className="ml-2" />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default CashHandlingGuide;
