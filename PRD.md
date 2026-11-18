# FrontDesk Pro — Product Requirements Document (PRD)

**Document Version:** 1.0.0  
**Status:** Approved / Active Baseline  
**Target Audience:** Engineering, Product Management, Hotel Operations & Stakeholders  
**Repository:** `CashDrawerManagementNew`  
**Deployment Environment:** Offline-First PWA (Vite + React) & Chrome Extension (Manifest V3)  

---

## 1. Executive Summary & Vision

### 1.1 Vision
**FrontDesk Pro** is an offline-first, decentralized Front Desk Operations & Cash Management Platform engineered specifically for independent hotels, boutique resorts, and branded franchises (e.g., Best Western, Choice Hotels, Wyndham). 

FrontDesk Pro consolidates four critical front-office operational silos into a single unified surface:
1. **Cash Drawer Balancing & Shift Reconciliation** (physical cash audit, drops, receipts, discrepancy calculations).
2. **Shift Handover, Issue Logging & Guest Complaints** (threaded communication, accountability, shift-to-shift reminders).
3. **Group Sales & Revenue Capture** (pipeline kanban, estimated revenue multipliers, closed room night tracking).
4. **Third-Party PMS Integration & DOM Automation** (a lightweight Manifest V3 Chrome Extension and contextual DOM script injector enabling 1-click log creation directly from Property Management System screens without context-switching).

### 1.2 Core Problem Statement
* **Cash Shrinkage & Auditing Friction:** Traditional paper tally sheets and clunky POS cash modules lead to unverified discrepancies during shift handovers.
* **Lost Guest Notes & Handover Breakdowns:** Sticky notes and disparate logbooks result in dropped guest complaints, unfulfilled guest promises, and missed sales opportunities.
* **PMS Separation:** Staff spend 8+ hours inside web-based PMS terminals (e.g., BWH Frontdesk Web, Opera Cloud) and resist opening secondary software, leading to incomplete record keeping.
* **Server Dependency & IT Overhead:** Small-to-medium hospitality properties often lack dedicated on-premise database servers or IT staff to maintain complex cloud infrastructure.

### 1.3 Key Value Propositions
* **100% Offline-First & Serverless P2P Sync:** Operates entirely in the browser using client-side IndexedDB with real-time peer-to-peer WebRTC synchronization across front desk workstations—no central database server required.
* **Deep PMS Workflow Integration:** The Chrome Extension and DOM injector bring FrontDesk Pro controls directly inside PMS reservation headers with auto-scraping for Guest Name, Room #, Folio/Reservation #, Phone, and Email.
* **Role-Based Security & Auditability:** Strict separation between Clerk and Manager permissions, immutable audit logs, and automatic PDF shift drop reports.

---

## 2. Target Audience & User Personas

| Persona | Role | Key Jobs to Be Done | Pain Points Addressed |
| :--- | :--- | :--- | :--- |
| **Front Desk Clerk** | Operational User | Open/close cash drawer, count bills/coins/rolls, log guest complaints, record group sales leads, review handover notes. | Eliminates manual math; auto-populates logs directly from PMS screens; provides instant shift balance verification. |
| **Shift Supervisor** | Team Lead | Monitor open registers across stations, verify cashier drops, reply to complaint threads, track urgent room maintenance. | Unified shift dashboard; live WebRTC sync across workstations; automated reminders for oncoming shifts. |
| **General Manager** | Administrator | Audit cash history, export daily PDF reconciliation sheets, configure custom log categories/questionnaires, manage staff accounts. | Complete audit trail; customizable questionnaire fields; database snapshot archives; zero IT maintenance. |
| **Sales Coordinator** | Commercial Lead | Triage inbound phone inquiries for wedding blocks, sports teams, and bus tours; track deal stages to confirmation. | Visual Kanban pipeline; automatic potential revenue calculation based on room nights and target rates. |

---

## 3. Product Architecture & System Overview

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                       FrontDesk Pro Ecosystem                               │
 └──────┬───────────────────────────────────────────────────────────────┬──────┘
        │                                                               │
 ┌──────▼───────────────────────────────────┐    ┌──────────────────────▼──────────────────┐
 │   FrontDesk Pro Web Application (PWA)    │    │   FrontDesk Pro Extension (Manifest V3) │
 │   • React 18 + TypeScript + Vite         │    │   • Floating 3D Animated Logbook Bubble │
 │   • Tailwind CSS + Lucide Icons          │    │   • BWH PMS DOM Script Auto-Injector    │
 │   • IndexedDB (idb v8) Persistence       │    │   • Native chrome.storage.local Cache   │
 │   • PeerJS WebRTC P2P Sync Mesh          │    │   • Background Service Worker Relay     │
 │   • jsPDF / jsPDF-AutoTable Reporting    │    │   • Custom Script Runner Modal          │
 └──────────────────┬───────────────────────┘    └──────────────────────┬──────────────────┘
                    │                                                   │
                    └───────────────────┬───────────────────────────────┘
                                        │ PostMessage & chrome.storage Bridge
                                        ▼
                         ┌─────────────────────────────┐
                         │ Shared Client State & Sync  │
                         │ • Categories & Questionnaires│
                         │ • Active Staff Session      │
                         │ • Shift Logs & Sales Leads  │
                         └─────────────────────────────┘
```

---

## 4. Functional Specifications & Modules

### 4.1 Module 1: Cash Drawer Management & Shift Reconciliation
* **Multi-Drawer Tracking:** Support for configurable parallel drawers (Drawer #1, Drawer #2, Drawer #3) with independent opening/closing balances.
* **Denomination Counter:**
  * **Bills:** \$100, \$50, \$20, \$10, \$5, \$2, \$1 with quantity multipliers.
  * **Loose Coins:** Quarters (\$0.25), Dimes (\$0.10), Nickels (\$0.05), Pennies (\$0.01).
  * **Rolls of Coins:** Quarter Rolls (\$10.00), Dime Rolls (\$5.00), Nickel Rolls (\$2.00), Penny Rolls (\$0.50).
  * **Paid-Out & Vendor Receipts:** Tabular tracking of expense receipts, payee description, and amounts deducted from the drawer.
* **Shift Lifecycle:**
  * **Open Shift:** Enforces opening balance count, cashier selection, and initial drawer verification.
  * **Active Shift:** Real-time summary displaying Opening Float, Paid-Outs, Cash Collected, and Current Calculated Total.
  * **Close Shift:** Blind or guided count comparing physical drawer total against expected balance; calculates Over/Short variance and Net Shift Drop.
* **Automated PDF & Thermal Reports:**
  * One-click generation of professional PDF shift audit reports via `jspdf` and `jspdf-autotable`.
  * Printable receipt generator formatted for 80mm thermal receipt printers.

### 4.2 Module 2: Shift Log & Front Desk Communication Hub
* **Log Entries:** Records staff notes, guest complaints, sales leads, handover announcements, and custom category events.
* **Categorization Engine:**
  * **Sales:** Contact name, phone, email, room requirement, check-in/out dates, estimated revenue, pipeline stage.
  * **Complaint:** Guest name, phone, room number, reservation/folio number, complaint status (`Open`, `In Progress`, `Resolved`), resolution notes.
  * **Miscellaneous / Shift Handover:** Topic/headline, contact, room/area, detailed handover observations.
  * **Custom Categories:** User-defined categories (e.g. `WaitList`, `Maintenance`, `Housekeeping`, `Lost & Found`, `VIP Guest`) with custom subcategories and questionnaires.
* **Threaded Responses:** Allows managers and oncoming staff to post time-stamped replies directly beneath log entries.
* **Reminders & Escalations:** Flag logs with follow-up dates; dynamic badge counters alert oncoming shifts of pending actions.
* **Filter & Search:** Real-time search across guest names, room numbers, folio numbers, clerk notes, and date ranges.

### 4.3 Module 3: Group Sales Pipeline & Revenue Tracking
* **Sales Kanban Board:** Visual 5-stage drag-and-drop pipeline:
  1. *New Lead*
  2. *Processing*
  3. *Tentative / Contract Sent*
  4. *Closed Definite (Won)*
  5. *Lost*
* **Dynamic Revenue Calculator:**
  * Auto-computes total room nights: $\text{Nights} = (\text{Check-Out} - \text{Check-In}) \times \text{Rooms}$.
  * Applies property-level rate multiplier (default: \$120/night) to project potential contract value.
* **Closed Definite Breakdown:** Multi-row room booking itemization (Room Type, Room Count, Offered Rate) with auto-calculated actual closed revenue.

### 4.4 Module 4: Dynamic Questionnaires & Category Engine
* **Form Customization:** Managers can configure form fields per category:
  * Enable/Disable fields.
  * Toggle Required (`*`) vs. Optional (`Opt`).
  * Customize field labels.
* **Custom Category Creation:** Add custom categories with custom icons (Lucide icon library), color badges, subcategory lists, and specialized additional fields.
* **Live Extension Mirroring:** Categories and questionnaire schemas created in the Manager Console instantly synchronize across all active browser extension bubbles.

### 4.5 Module 5: Role-Based Access Control (RBAC) & Security
* **User Roles:**
  * **Clerk:** Cash counting, shift opening/closing, log entry creation, thread replying, extension quick logging.
  * **Manager:** Access to Manager Console, user account creation/password resets, database purge/reset safeguards, organization settings, category customization, audit archives.
* **Database Snapshot & Archives:**
  * Automatic local snapshotting before database reset.
  * Protected database reset requiring the explicit confirmation phrase `Deletemydatalog`.

### 4.6 Module 6: Serverless Peer-to-Peer (P2P) WebRTC Sync
* **Mesh Network Protocol:** Uses PeerJS over WebRTC to synchronize state directly between front desk browsers on the local network.
* **Data Stores Synchronized:**
  * Shift records & drawer transactions.
  * Shift log entries, replies, and reminders.
  * Categories and custom questionnaires.
  * App settings and user accounts.
* **Collision Resolution & Discovery:** Device fingerprinting, station naming (e.g., Station A, Station B), epoch-based version tracking, and live connection health beacons.

### 4.7 Module 7: FrontDesk Pro Chrome Extension (Manifest V3)
* **Floating 3D Animated Logbook Widget:**
  * Free-floating 3D leather ledger book icon positioned on external web pages without intrusive background boxes.
  * Rhythmic cyan/gold glowing text animation indicating active status.
  * Interactive 3D cover open animation on click; form modal emerges smoothly from the open book.
* **Bidirectional Storage Bridge:**
  * Syncs active staff session, target app URL, and categories via `chrome.storage.local`.
  * Logs captured in the extension are stored in `chrome.storage.local` and broadcasted via `chrome.runtime.sendMessage` to update open web app registers immediately.
* **Extension Popup Controls:**
  * Staff status and login link.
  * Configurable web app target URL (`localhost` or hosted Netlify domain).
  * Direct DOM Script Runner: Upload, execute, and toggle auto-run for custom JavaScript automation scripts.

### 4.8 Module 8: BWH PMS DOM Integration & Script Runner
* **Target Domain:** Best Western Frontdesk Web (`americas.bwh.hkclients.com/frontdesk-web/*`).
* **Contextual Button Injection:**
  * Inserts clean `+ Complaint Log` and `+ Misc Log` buttons into the reservation header action group right beside the Edit Guest and Refresh icons.
  * Automatic cleanup loop prevents duplicate buttons in secondary tables (such as Guarantee Type).
* **Accurate DOM Scraping:**
  * Extracts Guest Name, Reservation/Folio #, and Room # from the primary title header (`div.date-title h4`: `14241009477 / JAMES CALVIN ANDERSON / Room - 405`).
  * Scrapes Phone and Email from reservation card elements while strictly ignoring top navbar clerk profile elements (`Sunny Kumar`).
* **1-Click Modal Autofill:** Clicking an injected button dispatches `FRONTDESK_AUTOFILL_LOG`, opens the floating logbook, switches to the appropriate tab, and populates all 5 fields.

---

## 5. Technical Stack & Implementation Details

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18.3.1 (with TypeScript 5.5) | Single-page reactive application |
| **Build Tool** | Vite 5.4.8 | Lightning-fast development & production bundling |
| **Styling & Icons** | Tailwind CSS 3.4.1 + Lucide React | Modern responsive design & iconography |
| **Client Storage** | IndexedDB via `idb` 8.0.0 | High-capacity offline structured data persistence |
| **P2P Networking** | PeerJS 1.5.5 (WebRTC) | Serverless multi-terminal synchronization |
| **PDF Generation** | jsPDF 2.5.1 + jsPDF-AutoTable 3.8.2 | Client-side vector PDF shift audit generation |
| **Browser Extension** | Chrome Manifest V3 | Content scripts, service worker, chrome.storage.local |
| **DOM Automation** | Vanilla ES6+ MutationObserver | Real-time PMS screen inspection and button injection |

---

## 6. Data Architecture & Storage Schema

### 6.1 IndexedDB Object Stores (`cash_drawer_db` v4)
* **`shifts`**: KeyPath `id`. Stores `ShiftRecord` objects. Indexes on `status` and `openTime`.
* **`shift_logs`**: KeyPath `id`. Stores `ShiftLogEntry` objects including threaded replies and custom questionnaire responses.
* **`log_categories`**: KeyPath `id`. Stores `LogCategoryConfig` (Sales, Complaint, Misc, WaitList, etc.) and category questionnaire schemas.
* **`users`**: KeyPath `id`. Stores `UserAccount` records with unique `username` index.
* **`app_settings`**: KeyPath `id`. Stores property organization name, sales rate multiplier, max open drawers, print preferences, and form field settings.
* **`organization`**: KeyPath `id`. Stores property branding and contact metadata.

### 6.2 Chrome Storage Schema (`chrome.storage.local`)
* **`frontdesk_user`**: Active authenticated staff object `{ id, fullName, role, username }`.
* **`frontdesk_app_url`**: Target web app URL (`http://localhost:5173/app` or production Netlify URL).
* **`frontdesk_categories`**: Cached array of active `LogCategoryConfig` objects for instant tab rendering.
* **`frontdesk_logs`**: Queue of pending logs created from external tabs awaiting synchronization.
* **`fdp_bubble_pos`**: Stored screen coordinates `{ x, y }` for draggable floating trigger persistence.
* **`fdp_custom_script`** & **`fdp_auto_run_script`**: Injected script runner source code and auto-execution toggle.

---

## 7. Non-Functional & Quality Requirements

* **Zero-Latency Responsiveness:** Denomination counter and sales revenue calculations update synchronously within 16ms (60 FPS).
* **Offline Resilience:** All primary features—including shift opening/closing, counting, logging, and PDF generation—function without an internet connection.
* **Cross-Station Consistency:** WebRTC synchronization replicates logs and drawer events across stations in $< 500\text{ms}$ under normal local network conditions.
* **Security & Sandboxing:** Content scripts operate within standard browser isolation without reading cookies, tokens, or payment card data from third-party PMS pages.
* **Non-Destructive DOM Injection:** Injected buttons match the host application's typography and palette without disrupting the PMS's native event listeners or DOM structure.

---

## 8. Release & Deployment Strategy

* **Web Application:** Continuous deployment via Git branch integration (Netlify / static hosting) with automated Vite production builds.
* **Chrome Extension Packaging:** Automated bundle generation via `node scripts/package-extension.js`, generating production ZIP artifacts (`public/frontdesk-pro-extension.zip` and `dist/frontdesk-pro-extension.zip`) ready for direct developer mode loading or Chrome Web Store publication.

---

## 9. Future Roadmap

1. **Direct Cloud Database Connector (Optional Hybrid Mode):** Optional Supabase / Firebase integration for off-site owners desiring remote portfolio dashboards while maintaining offline-first local fallbacks.
2. **AI Shift Summary Assistant:** End-of-shift automated generative summarization of critical guest complaints, unresolved maintenance tasks, and pending revenue leads.
3. **Multi-Property Group Switcher:** Instant switching between sister properties for regional management groups.
4. **Hardware Serial Port Integration:** Direct WebHID / WebSerial communication with physical cash drawers and POS thermal receipt printers.
