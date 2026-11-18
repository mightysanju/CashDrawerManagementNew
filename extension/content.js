// FrontDesk Pro — Floating Shift Log Extension Content Script
(function () {
  const hostname = window.location.hostname;
  const hasAppMeta = !!document.querySelector('meta[name="frontdesk-pro-app"]');
  const isFrontDeskApp =
    hasAppMeta ||
    (document.title && (document.title.includes('FrontDesk Pro') || document.title.includes('Cash Drawer'))) ||
    hostname.includes('cashdrawermanagement') ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1';

  // =========================================================================
  // 1. FRONTDESK PRO WEB APP BRIDGE (Runs on cashdrawermanagement.netlify.app & localhost)
  // =========================================================================
  if (isFrontDeskApp) {
    const detectedAppUrl = window.location.origin + (window.location.pathname.startsWith('/app') ? '/app' : '/app');
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ frontdesk_app_url: detectedAppUrl });
    }

    function getLocalSessionUser() {
      try {
        const raw =
          localStorage.getItem('cdm_session_user') ||
          sessionStorage.getItem('cdm_session_user') ||
          localStorage.getItem('frontdesk_auth_session') ||
          sessionStorage.getItem('frontdesk_auth_session');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && parsed.fullName ? parsed : (parsed.user || null);
      } catch {
        return null;
      }
    }

    function syncUserToExtension(user) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        if (user && user.fullName) {
          chrome.storage.local.set({ frontdesk_user: user });
          if (chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ type: 'FDP_USER_CHANGED', user }).catch(() => {});
          }
        } else {
          chrome.storage.local.remove(['frontdesk_user']);
          if (chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ type: 'FDP_USER_CHANGED', user: null }).catch(() => {});
          }
        }
      }
    }

    let lastSyncedUserId = null;
    function checkAndSyncSession() {
      const current = getLocalSessionUser();
      const currentId = current ? current.id : null;
      if (currentId !== lastSyncedUserId) {
        lastSyncedUserId = currentId;
        syncUserToExtension(current);
      }
    }

    checkAndSyncSession();
    setInterval(checkAndSyncSession, 1500);

    // Sync categories from web app to chrome.storage
    function syncCategoriesToExtension(cats) {
      if (!Array.isArray(cats) || cats.length === 0) return;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ frontdesk_categories: cats });
        if (chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ type: 'FDP_CATEGORIES_CHANGED', categories: cats }).catch(() => {});
        }
      }
    }

    let lastCategoriesCache = null;
    function checkAndSyncCategories() {
      try {
        const raw = localStorage.getItem('frontdesk_categories_cache');
        if (raw && raw !== lastCategoriesCache) {
          lastCategoriesCache = raw;
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            syncCategoriesToExtension(parsed);
          }
        }
      } catch (e) {
        // ignore
      }
    }

    checkAndSyncCategories();
    setInterval(checkAndSyncCategories, 1500);

    // Listen for direct postMessage from React main world
    window.addEventListener('message', (event) => {
      if (event.source !== window || !event.data || typeof event.data !== 'object') return;

      if (event.data.type === 'FDP_APP_USER_SYNC') {
        const user = event.data.user;
        lastSyncedUserId = user ? user.id : null;
        syncUserToExtension(user);
      }

      if (event.data.type === 'FDP_CATEGORIES_SYNC') {
        const cats = event.data.categories;
        if (Array.isArray(cats) && cats.length > 0) {
          lastCategoriesCache = JSON.stringify(cats);
          syncCategoriesToExtension(cats);
        }
      }

      if (event.data.type === 'FDP_PURGE_EXTENSION_STORAGE') {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.remove(['frontdesk_logs']);
        }
        try {
          localStorage.removeItem('frontdesk_external_logs');
          localStorage.removeItem('frontdesk_logs');
        } catch (e) {
          // ignore
        }
      }

      if (event.data.type === 'FDP_DELETE_LOG' && event.data.logId) {
        const delId = event.data.logId;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['frontdesk_logs'], (res) => {
            const logs = res.frontdesk_logs || [];
            const filtered = logs.filter((l) => l && l.id !== delId);
            chrome.storage.local.set({ frontdesk_logs: filtered });
          });
        }
        try {
          const existing = JSON.parse(localStorage.getItem('frontdesk_external_logs') || '[]');
          const filtered = existing.filter((l) => l && l.id !== delId);
          localStorage.setItem('frontdesk_external_logs', JSON.stringify(filtered));
        } catch (e) {}
      }

      if (event.data.type === 'FDP_UPDATE_LOG' && event.data.log) {
        const updatedLog = event.data.log;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['frontdesk_logs'], (res) => {
            const logs = res.frontdesk_logs || [];
            const idx = logs.findIndex((l) => l && l.id === updatedLog.id);
            if (idx >= 0) {
              logs[idx] = { ...logs[idx], ...updatedLog };
              chrome.storage.local.set({ frontdesk_logs: logs });
            }
          });
        }
        try {
          const existing = JSON.parse(localStorage.getItem('frontdesk_external_logs') || '[]');
          const idx = existing.findIndex((l) => l && l.id === updatedLog.id);
          if (idx >= 0) {
            existing[idx] = { ...existing[idx], ...updatedLog };
            localStorage.setItem('frontdesk_external_logs', JSON.stringify(existing));
          }
        } catch (e) {}
      }

      if (event.data.type === 'FDP_REQUEST_PENDING_LOGS') {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['frontdesk_logs'], (res) => {
            if (res && Array.isArray(res.frontdesk_logs) && res.frontdesk_logs.length > 0) {
              window.postMessage({ type: 'FDP_EXTENSION_LOGS_SYNC', logs: res.frontdesk_logs }, '*');
            }
          });
        }
      }
    });

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.frontdesk_logs) {
          const newLogs = changes.frontdesk_logs.newValue || [];
          if (Array.isArray(newLogs) && newLogs.length > 0) {
            window.postMessage({ type: 'FDP_EXTENSION_LOGS_SYNC', logs: newLogs }, '*');
          }
        }
      });
    }

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.type === 'FDP_NEW_LOG_BROADCAST' && msg.log) {
          window.postMessage({ type: 'FDP_EXTENSION_LOG_RECEIVED', log: msg.log }, '*');
        }
      });
    }

    return;
  }

  // =========================================================================
  // 2. FOR ALL OTHER WEBSITES (PMS, OTA Portals, BWH, Google, CRM)
  // Render the Floating Quick Log Bubble
  // =========================================================================
  const existingRoot = document.getElementById('fdp-bubble-root');
  if (existingRoot) {
    existingRoot.remove();
  }

  const root = document.createElement('div');
  root.id = 'fdp-bubble-root';
  const mountTarget = document.body || document.documentElement;
  if (!mountTarget) return;
  mountTarget.appendChild(root);

  let currentStaff = null;
  const iconUrl = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
    ? chrome.runtime.getURL('favicon.png')
    : '/favicon.png';

  // Inject UI Skeleton
  root.innerHTML = `
    <!-- Floating Trigger (Free-floating 3D Book Icon — No Square Background) -->
    <div class="fdp-floating-trigger" id="fdp-trigger" title="FrontDesk Pro — Quick Log (Drag anywhere)">
      <svg class="fdp-logbook-svg logbook-stack-3d" viewBox="0 0 44 48" width="48" height="52" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="22" cy="45" rx="14" ry="2" fill="rgba(0,0,0,0.35)" />
        <rect x="7" y="5" width="31" height="37" rx="3" fill="#0b1120" />
        <rect x="9" y="6" width="30" height="35" rx="2" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.75" />
        <line x1="36" y1="9" x2="36" y2="38" stroke="#94a3b8" stroke-width="0.75" stroke-dasharray="1.5 1.5" />
        <line x1="37.5" y1="10" x2="37.5" y2="37" stroke="#cbd5e1" stroke-width="0.5" />
        <line x1="14" y1="13" x2="32" y2="13" stroke="#60a5fa" stroke-width="1" stroke-linecap="round" />
        <line x1="14" y1="18" x2="30" y2="18" stroke="#94a3b8" stroke-width="0.75" stroke-linecap="round" />
        <line x1="14" y1="23" x2="32" y2="23" stroke="#94a3b8" stroke-width="0.75" stroke-linecap="round" />
        <line x1="14" y1="28" x2="28" y2="28" stroke="#94a3b8" stroke-width="0.75" stroke-linecap="round" />
        <line x1="14" y1="33" x2="31" y2="33" stroke="#94a3b8" stroke-width="0.75" stroke-linecap="round" />
        <path d="M17 24 L17 44 L20 41.5 L23 44 L23 24 Z" fill="#10b981" class="fdp-ribbon" />
        <g class="logbook-cover-3d">
          <rect x="5" y="4" width="32" height="39" rx="3.5" fill="url(#ext-logbook-leather)" stroke="#334155" stroke-width="0.8" />
          <rect x="4.5" y="4" width="6" height="39" rx="2" fill="#090d16" />
          <line x1="6.5" y1="11" x2="9.5" y2="11" stroke="#f59e0b" stroke-width="1.2" stroke-linecap="round" />
          <line x1="6.5" y1="23.5" x2="9.5" y2="23.5" stroke="#f59e0b" stroke-width="1.2" stroke-linecap="round" />
          <line x1="6.5" y1="36" x2="9.5" y2="36" stroke="#f59e0b" stroke-width="1.2" stroke-linecap="round" />
          <rect x="13.5" y="12" width="18" height="15" rx="2" fill="#0f172a" stroke="#f59e0b" stroke-width="0.75" />
          <line x1="16" y1="16" x2="28" y2="16" stroke="#38bdf8" stroke-width="1.2" stroke-linecap="round" class="fdp-book-text-line fdp-line-1" />
          <line x1="16" y1="19.5" x2="25.5" y2="19.5" stroke="#f1f5f9" stroke-width="1" stroke-linecap="round" class="fdp-book-text-line fdp-line-2" />
          <line x1="16" y1="23" x2="27" y2="23" stroke="#94a3b8" stroke-width="0.8" stroke-linecap="round" class="fdp-book-text-line fdp-line-3" />
          <path d="M33 4.5 L36.5 4.5 L36.5 8 Z" fill="#94a3b8" opacity="0.6" />
          <path d="M33 42.5 L36.5 42.5 L36.5 39 Z" fill="#94a3b8" opacity="0.6" />
        </g>
        <defs>
          <linearGradient id="ext-logbook-leather" x1="5" y1="4" x2="37" y2="43" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#1e293b" />
            <stop offset="45%" stop-color="#0f172a" />
            <stop offset="100%" stop-color="#090d16" />
          </linearGradient>
        </defs>
      </svg>
    </div>

    <!-- Floating Form Modal -->
    <div class="fdp-modal-overlay" id="fdp-modal">
      <!-- Header -->
      <div class="fdp-header">
        <div class="fdp-header-left">
          <img src="${iconUrl}" class="fdp-header-icon" alt="FrontDesk Pro" />
          <div class="fdp-header-title">FrontDesk Pro Quick Log</div>
        </div>
        <button class="fdp-close-btn" id="fdp-close" title="Close">&times;</button>
      </div>

      <!-- Staff Info Bar -->
      <div id="fdp-staff-container"></div>

      <!-- Login Gate -->
      <div id="fdp-login-gate" style="display: none; padding: 24px 20px; text-align: center;">
        <div style="width: 44px; height: 44px; margin: 0 auto 12px; background: #eff6ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #2563eb;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 6px;">Staff Sign-In Required</h3>
        <p style="font-size: 12px; color: #64748b; margin: 0 0 16px; line-height: 1.45;">
          Please sign in to your FrontDesk Pro register to record shift logs, guest complaints, and group sales leads.
        </p>
        <button id="fdp-open-app-btn" type="button" class="fdp-submit-btn" style="width: 100%;">
          <span>Sign In to FrontDesk Pro &rarr;</span>
        </button>
      </div>

      <!-- Form Content -->
      <div id="fdp-form-container" style="display: none; flex: 1; flex-direction: column; overflow: hidden;">
        <div class="fdp-tabs" id="fdp-tabs-bar"></div>

        <form class="fdp-body" id="fdp-form" novalidate>
          <!-- SALES FIELDS -->
          <div id="fdp-sales-fields">
            <div class="fdp-field">
              <label class="fdp-label">Subcategory *</label>
              <select class="fdp-select" id="fdp-sales-subcat">
                <option value="Group">Group</option>
                <option value="Wedding">Wedding</option>
                <option value="Sports team">Sports team</option>
                <option value="Company">Company</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div class="fdp-field" style="margin-top:6px;">
              <label class="fdp-label">Lead / Contact Name *</label>
              <input type="text" class="fdp-input" id="fdp-sales-name" placeholder="e.g. Acme Tech Conference" />
            </div>

            <div class="fdp-grid-2" style="margin-top:6px;">
              <div class="fdp-field">
                <label class="fdp-label">Phone *</label>
                <input type="tel" class="fdp-input" id="fdp-sales-phone" placeholder="(555) 000-0000" />
              </div>
              <div class="fdp-field">
                <label class="fdp-label">Email (Optional)</label>
                <input type="email" class="fdp-input" id="fdp-sales-email" placeholder="name@domain.com" />
              </div>
            </div>

            <div class="fdp-grid-2" style="margin-top:6px;">
              <div class="fdp-field">
                <label class="fdp-label">Target Check-In</label>
                <input type="date" class="fdp-input" id="fdp-sales-in" />
              </div>
              <div class="fdp-field">
                <label class="fdp-label">Target Check-Out</label>
                <input type="date" class="fdp-input" id="fdp-sales-out" />
              </div>
            </div>

            <div class="fdp-grid-2" style="margin-top:6px;">
              <div class="fdp-field">
                <label class="fdp-label">Rooms *</label>
                <input type="number" min="1" value="1" class="fdp-input" id="fdp-sales-rooms" />
              </div>
              <div class="fdp-field">
                <label class="fdp-label">Pipeline Status</label>
                <select class="fdp-select" id="fdp-sales-status">
                  <option value="New Lead">1. New Lead</option>
                  <option value="Processing">2. Processing</option>
                  <option value="Closed Definite">3. Definite (Won)</option>
                  <option value="Lost">4. Lost</option>
                </select>
              </div>
            </div>

            <div class="fdp-rev-calc">
              <span>Room Nights: <strong id="fdp-est-nights">1</strong></span>
              <span>Est. Revenue: <strong class="fdp-rev-value" id="fdp-est-rev">$120</strong></span>
            </div>
          </div>

          <!-- COMPLAINT FIELDS -->
          <div id="fdp-complaint-fields" style="display: none;">
            <div class="fdp-field">
              <label class="fdp-label">Issue Type *</label>
              <select class="fdp-select" id="fdp-comp-subcat">
                <option value="Room Maintenance">Room Maintenance</option>
                <option value="Noise / Disturbance">Noise / Disturbance</option>
                <option value="Billing & Folio">Billing & Folio</option>
                <option value="Housekeeping / Cleanliness">Housekeeping / Cleanliness</option>
                <option value="Staff / Service">Staff / Service</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div class="fdp-field" style="margin-top:6px;">
              <label class="fdp-label">Guest Name *</label>
              <input type="text" class="fdp-input" id="fdp-comp-name" placeholder="Guest Full Name" />
            </div>

            <div class="fdp-grid-2" style="margin-top:6px;">
              <div class="fdp-field">
                <label class="fdp-label">Phone *</label>
                <input type="tel" class="fdp-input" id="fdp-comp-phone" placeholder="(555) 000-0000" />
              </div>
              <div class="fdp-field">
                <label class="fdp-label">Room # (Optional)</label>
                <input type="text" class="fdp-input" id="fdp-comp-room" placeholder="e.g. 214" />
              </div>
            </div>

            <div class="fdp-field" style="margin-top:6px;">
              <label class="fdp-label">Reservation / Folio # (Optional)</label>
              <input type="text" class="fdp-input" id="fdp-comp-res" placeholder="e.g. RES-49102" />
            </div>
          </div>

          <!-- MISCELLANEOUS / SHIFT NOTE / CUSTOM CATEGORY FIELDS -->
          <div id="fdp-misc-fields" style="display: none;">
            <div class="fdp-grid-2">
              <div class="fdp-field">
                <label class="fdp-label" id="fdp-misc-topic-label">Task / Item Summary *</label>
                <input type="text" class="fdp-input" id="fdp-misc-topic" placeholder="e.g. Miscellaneous note" />
              </div>
              <div class="fdp-field">
                <label class="fdp-label">Subcategory *</label>
                <select class="fdp-select" id="fdp-custom-subcat">
                  <option value="Shift Handover">Shift Handover</option>
                  <option value="General">General</option>
                  <option value="Package Delivery">Package Delivery</option>
                  <option value="Lost & Found">Lost & Found</option>
                  <option value="Maintenance Request">Maintenance Request</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div class="fdp-grid-2" style="margin-top:6px;">
              <div class="fdp-field">
                <label class="fdp-label" id="fdp-misc-name-label">Staff / Guest Contact (Optional)</label>
                <input type="text" class="fdp-input" id="fdp-custom-name" placeholder="e.g. Staff or guest" />
              </div>
              <div class="fdp-field">
                <label class="fdp-label" id="fdp-misc-room-label">Room / Area (Optional)</label>
                <input type="text" class="fdp-input" id="fdp-custom-room" placeholder="e.g. 102" />
              </div>
            </div>

            <div id="fdp-custom-questions-wrap" style="display:none; margin-top:6px; padding:8px 10px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px;">
              <span id="fdp-custom-q-heading" style="font-size:10px; font-weight:700; text-transform:uppercase; color:#1e40af; display:block; margin-bottom:4px;">Additional Fields</span>
              <div id="fdp-custom-questions-list" style="display:grid; grid-template-columns:1fr 1fr; gap:6px;"></div>
            </div>
          </div>

          <!-- NOTES -->
          <div class="fdp-field" style="margin-top:6px;">
            <label class="fdp-label" id="fdp-notes-label">Details / Observations *</label>
            <textarea class="fdp-textarea" id="fdp-notes" rows="3" placeholder="Details, special requests, or handover notes..."></textarea>
          </div>

          <div class="fdp-checkbox-row" style="margin-top:6px;">
            <input type="checkbox" id="fdp-has-reminder" />
            <label for="fdp-has-reminder">Set Reminder for Next Shift / Management</label>
          </div>

          <button type="submit" class="fdp-submit-btn" id="fdp-submit">
            <span id="fdp-submit-text">Save Complaint</span>
          </button>

          <div class="fdp-success-banner" id="fdp-success" style="display:none; margin-top:6px;">
            Shift log recorded and synced to register
          </div>
        </form>
      </div>
    </div>
  `;

  // Elements
  const trigger = root.querySelector('#fdp-trigger');
  const modal = root.querySelector('#fdp-modal');
  const closeBtn = root.querySelector('#fdp-close');
  const staffContainer = root.querySelector('#fdp-staff-container');
  const loginGate = root.querySelector('#fdp-login-gate');
  const formContainer = root.querySelector('#fdp-form-container');
  const openAppBtn = root.querySelector('#fdp-open-app-btn');
  const form = root.querySelector('#fdp-form');

  const salesFields = root.querySelector('#fdp-sales-fields');
  const compFields = root.querySelector('#fdp-complaint-fields');
  const miscFields = root.querySelector('#fdp-misc-fields');

  const DEFAULT_CATEGORIES = [
    { id: 'cat_complaint', name: 'Complaint', icon: 'AlertTriangle', subcategories: ['Room Maintenance', 'Noise / Disturbance', 'Billing & Folio', 'Housekeeping / Cleanliness', 'Staff / Service', 'Other'] },
    { id: 'cat_misc', name: 'Shift Note', icon: 'Tag', subcategories: ['Shift Handover', 'General', 'Package Delivery', 'Lost & Found', 'Maintenance Request', 'Other'] },
    { id: 'cat_sales', name: 'Sales', icon: 'Building2', subcategories: ['Group', 'Wedding', 'Sports team', 'Company', 'Other'] }
  ];

  let currentCategories = [...DEFAULT_CATEGORIES];
  let activeCat = 'Complaint';

  // Revenue estimation in Sales tab
  const salesIn = document.getElementById('fdp-sales-in');
  const salesOut = document.getElementById('fdp-sales-out');
  const salesRooms = document.getElementById('fdp-sales-rooms');
  const estNights = document.getElementById('fdp-est-nights');
  const estRev = document.getElementById('fdp-est-rev');

  function updateSalesEstimate() {
    if (!salesIn || !salesOut || !salesRooms || !estNights || !estRev) return;
    const inVal = salesIn.value;
    const outVal = salesOut.value;
    let nights = 1;
    if (inVal && outVal) {
      const d1 = new Date(inVal);
      const d2 = new Date(outVal);
      const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
      if (diff > 0) nights = diff;
    }
    const rms = parseInt(salesRooms.value, 10) || 1;
    const totalNights = rms * nights;
    estNights.textContent = String(totalNights);
    estRev.textContent = `$${(totalNights * 120).toLocaleString()}`;
  }

  if (salesIn) salesIn.addEventListener('change', updateSalesEstimate);
  if (salesOut) salesOut.addEventListener('change', updateSalesEstimate);
  if (salesRooms) salesRooms.addEventListener('input', updateSalesEstimate);

  // Render Login State inside Bubble
  function renderStaffState() {
    if (currentStaff && currentStaff.fullName) {
      staffContainer.innerHTML = `
        <div class="fdp-staff-bar">
          <div class="fdp-staff-left">
            <span class="fdp-staff-label">Logged in as:</span>
            <strong class="fdp-staff-name">${currentStaff.fullName}</strong>
          </div>
          <span class="fdp-staff-role">${(currentStaff.role || 'MANAGER').toUpperCase()}</span>
        </div>
      `;
    } else {
      staffContainer.innerHTML = `
        <div class="fdp-staff-bar" style="background:#eff6ff; border-bottom:1px solid #bfdbfe; color:#1e40af;">
          <div class="fdp-staff-left">
            <span class="fdp-staff-label">Logged in as:</span>
            <strong class="fdp-staff-name">Front Desk Staff</strong>
          </div>
          <span class="fdp-staff-role" style="background:#ede9fe; color:#4338ca;">ACTIVE</span>
        </div>
      `;
    }
    if (loginGate) loginGate.style.display = 'none';
    if (formContainer) formContainer.style.display = 'flex';
  }

  function getCategoryTagColor(catName) {
    const norm = (catName || '').toLowerCase();
    if (norm.includes('complaint')) return '#e11d48';
    if (norm.includes('sales')) return '#059669';
    if (norm.includes('wait') || norm.includes('trophy')) return '#d97706';
    return '#4f46e5';
  }

  function getCategorySvgIcon(cat) {
    const norm = ((cat && cat.name) || '').toLowerCase();
    const color = getCategoryTagColor(cat ? cat.name : '');
    if (norm.includes('sales') || (cat && cat.icon && cat.icon.toLowerCase().includes('building'))) {
      return `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; pointer-events:none;">
          <rect width="16" height="20" x="4" y="2" rx="2" ry="2"></rect>
          <path d="M9 22v-4h6v4"></path>
          <path d="M8 6h.01"></path>
          <path d="M16 6h.01"></path>
          <path d="M8 10h.01"></path>
          <path d="M16 10h.01"></path>
          <path d="M8 14h.01"></path>
          <path d="M16 14h.01"></path>
        </svg>
      `;
    }
    return `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; pointer-events:none;">
        <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"></path>
        <path d="M7 7h.01"></path>
      </svg>
    `;
  }

  function renderCategoryTabs() {
    const tabsBar = root.querySelector('#fdp-tabs-bar');
    if (!tabsBar) return;
    tabsBar.innerHTML = '';

    const list = (currentCategories && currentCategories.length > 0) ? currentCategories : DEFAULT_CATEGORIES;

    const hasActive = list.some((c) => {
      const cNorm = (c.name || '').toLowerCase();
      const aNorm = activeCat.toLowerCase();
      return cNorm === aNorm ||
             (cNorm === 'miscellaneous' && aNorm === 'shift note') ||
             (cNorm === 'shift note' && aNorm === 'miscellaneous');
    });
    if (!hasActive && list.length > 0) {
      activeCat = list[0].name;
    }

    list.forEach((cat) => {
      const cNorm = (cat.name || '').toLowerCase();
      const aNorm = activeCat.toLowerCase();
      const isSelected = cNorm === aNorm ||
        (cNorm === 'miscellaneous' && aNorm === 'shift note') ||
        (cNorm === 'shift note' && aNorm === 'miscellaneous');

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `fdp-tab ${isSelected ? 'active' : ''}`;
      btn.setAttribute('data-cat', cat.name);

      let displayName = cat.name;
      if (displayName.toLowerCase() === 'miscellaneous') {
        displayName = 'Shift Note';
      }

      const iconSvg = getCategorySvgIcon(cat);
      btn.innerHTML = `${iconSvg}<span class="fdp-tab-label" style="pointer-events:none;">${displayName}</span>`;

      const handleActivate = (e) => {
        if (e) e.stopPropagation();
        selectCategory(cat.name);
      };

      btn.addEventListener('click', handleActivate);
      btn.addEventListener('pointerdown', handleActivate);

      tabsBar.appendChild(btn);
    });

    // Delegated fallback for container
    tabsBar.onclick = (e) => {
      const tab = e.target.closest('.fdp-tab');
      if (tab) {
        const catName = tab.getAttribute('data-cat');
        if (catName) selectCategory(catName);
      }
    };
    tabsBar.onpointerdown = (e) => {
      const tab = e.target.closest('.fdp-tab');
      if (tab) {
        const catName = tab.getAttribute('data-cat');
        if (catName) selectCategory(catName);
      }
    };

    updateFormFieldsForActiveCategory();
  }

  function selectCategory(categoryName) {
    if (!categoryName) return;
    activeCat = categoryName;

    const allTabBtns = root.querySelectorAll('.fdp-tab');
    allTabBtns.forEach((tb) => {
      const tbCat = (tb.getAttribute('data-cat') || '').trim().toLowerCase();
      const aNorm = activeCat.trim().toLowerCase();
      const match = tbCat === aNorm ||
                    (tbCat === 'shift note' && aNorm === 'miscellaneous') ||
                    (tbCat === 'miscellaneous' && aNorm === 'shift note');
      if (match) {
        tb.classList.add('active');
      } else {
        tb.classList.remove('active');
      }
    });

    updateFormFieldsForActiveCategory();
  }

  function populateSelectOptions(selectEl, newOptions) {
    if (!selectEl || !Array.isArray(newOptions) || newOptions.length === 0) return;

    const currentOptions = Array.from(selectEl.options).map((o) => o.value);
    const isSame = currentOptions.length === newOptions.length &&
                   currentOptions.every((val, idx) => val === newOptions[idx]);

    const previousValue = selectEl.value;

    if (!isSame) {
      selectEl.innerHTML = '';
      newOptions.forEach((s) => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        selectEl.appendChild(opt);
      });
    }

    if (previousValue && newOptions.includes(previousValue)) {
      selectEl.value = previousValue;
    } else if (newOptions.length > 0) {
      selectEl.value = newOptions[0];
    }
  }

  function updateFormFieldsForActiveCategory() {
    const norm = activeCat.trim().toLowerCase();
    const isSales = norm === 'sales';
    const isComp = norm === 'complaint';
    const isMisc = norm === 'miscellaneous' || norm === 'shift note';
    const isCustom = !isSales && !isComp;

    const salesEl = root.querySelector('#fdp-sales-fields');
    const compEl = root.querySelector('#fdp-complaint-fields');
    const miscEl = root.querySelector('#fdp-misc-fields');
    const qWrap = root.querySelector('#fdp-custom-questions-wrap');

    if (salesEl) salesEl.style.display = isSales ? 'block' : 'none';
    if (compEl) compEl.style.display = isComp ? 'block' : 'none';
    if (miscEl) miscEl.style.display = isCustom ? 'block' : 'none';

    const currentCatObj = (currentCategories && currentCategories.find((c) => {
      const cNorm = (c.name || '').toLowerCase();
      return cNorm === norm || (cNorm === 'miscellaneous' && norm === 'shift note') || (cNorm === 'shift note' && norm === 'miscellaneous');
    })) || DEFAULT_CATEGORIES.find((c) => {
      const cNorm = (c.name || '').toLowerCase();
      return cNorm === norm || (cNorm === 'miscellaneous' && norm === 'shift note') || (cNorm === 'shift note' && norm === 'miscellaneous');
    });

    const submitText = root.querySelector('#fdp-submit-text');
    if (submitText) {
      if (isSales) submitText.textContent = 'Save Sales Lead';
      else if (isComp) submitText.textContent = 'Save Complaint';
      else if (isMisc) submitText.textContent = 'Save Shift Log';
      else submitText.textContent = `Save ${activeCat} Log`;
    }

    const notesLabel = root.querySelector('#fdp-notes-label');
    const notesInput = root.querySelector('#fdp-notes');

    if (isSales) {
      if (qWrap) qWrap.style.display = 'none';
      const salesSubSelect = root.querySelector('#fdp-sales-subcat');
      const salesSubs = (currentCatObj && Array.isArray(currentCatObj.subcategories) && currentCatObj.subcategories.length > 0)
        ? currentCatObj.subcategories
        : ['Group', 'Wedding', 'Sports team', 'Company', 'Other'];
      populateSelectOptions(salesSubSelect, salesSubs);

      if (notesLabel) notesLabel.textContent = 'Clerk Notes / Deal Terms *';
      if (notesInput) notesInput.placeholder = 'Group requirements, special rates, or notes...';
    } else if (isComp) {
      if (qWrap) qWrap.style.display = 'none';
      const compSubSelect = root.querySelector('#fdp-comp-subcat');
      const compSubs = (currentCatObj && Array.isArray(currentCatObj.subcategories) && currentCatObj.subcategories.length > 0)
        ? currentCatObj.subcategories
        : ['Room Maintenance', 'Noise / Disturbance', 'Billing & Folio', 'Housekeeping / Cleanliness', 'Staff / Service', 'Other'];
      populateSelectOptions(compSubSelect, compSubs);

      if (notesLabel) notesLabel.textContent = 'Complaint Details / Action Taken *';
      if (notesInput) notesInput.placeholder = 'Guest feedback, resolution attempts, or staff notes...';
    } else {
      const miscTopicLabel = root.querySelector('#fdp-misc-topic-label');
      const miscTopicInput = root.querySelector('#fdp-misc-topic');
      if (miscTopicLabel) miscTopicLabel.textContent = isMisc ? 'Task / Item Summary *' : `${activeCat} Item Summary *`;
      if (miscTopicInput) miscTopicInput.placeholder = isMisc ? 'e.g. Miscellaneous note' : `e.g. ${activeCat} note`;

      if (notesLabel) {
        notesLabel.textContent = isMisc ? 'Details / Observations *' : `${activeCat} Details / Observations *`;
      }
      if (notesInput) notesInput.placeholder = 'Details, special requests, or handover notes...';

      // Populate subcategories for custom category
      const subcatSelect = root.querySelector('#fdp-custom-subcat');
      const customSubs = (currentCatObj && Array.isArray(currentCatObj.subcategories) && currentCatObj.subcategories.length > 0)
        ? currentCatObj.subcategories
        : ['Shift Handover', 'General', 'Package Delivery', 'Lost & Found', 'Maintenance Request', 'Other'];
      populateSelectOptions(subcatSelect, customSubs);

      // Populate custom questionnaire questions if defined
      const qList = root.querySelector('#fdp-custom-questions-list');
      if (qWrap && qList) {
        qList.innerHTML = '';
        const standardIds = new Set(['guestName', 'phoneNumber', 'email', 'roomRequirement', 'dates', 'clerkNotes', 'reminder', 'roomNumber', 'reservationNumber', 'topic', 'subCategory']);
        const customQuestions = (currentCatObj?.questionnaire || []).filter((q) => !standardIds.has(q.id) && q.enabled !== false);

        if (customQuestions.length > 0) {
          qWrap.style.display = 'block';
          const heading = root.querySelector('#fdp-custom-q-heading');
          if (heading) heading.textContent = `Additional Fields (${customQuestions.length})`;
          customQuestions.forEach((q) => {
            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'fdp-field';
            fieldDiv.style.marginBottom = '4px';

            const lbl = document.createElement('label');
            lbl.className = 'fdp-label';
            lbl.style.fontSize = '10px';
            lbl.textContent = `${q.label} ${q.required ? '*' : '(Opt)'}`;

            const inp = document.createElement('input');
            inp.type = 'text';
            inp.className = 'fdp-input';
            inp.style.fontSize = '11px';
            inp.style.padding = '4px 6px';
            inp.placeholder = `Enter ${q.label}...`;
            inp.setAttribute('data-custom-qid', q.id);

            fieldDiv.appendChild(lbl);
            fieldDiv.appendChild(inp);
            qList.appendChild(fieldDiv);
          });
        } else {
          qWrap.style.display = 'none';
        }
      }
    }
  }

  // Load staff & categories from chrome storage
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['frontdesk_user', 'frontdesk_categories'], (res) => {
      currentStaff = res && res.frontdesk_user && res.frontdesk_user.fullName ? res.frontdesk_user : null;
      if (res && Array.isArray(res.frontdesk_categories) && res.frontdesk_categories.length > 0) {
        currentCategories = res.frontdesk_categories;
      }
      renderStaffState();
      renderCategoryTabs();
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        if (changes.frontdesk_user) {
          currentStaff = changes.frontdesk_user.newValue && changes.frontdesk_user.newValue.fullName ? changes.frontdesk_user.newValue : null;
          renderStaffState();
        }
        if (changes.frontdesk_categories) {
          const newCats = changes.frontdesk_categories.newValue;
          if (Array.isArray(newCats) && newCats.length > 0) {
            currentCategories = newCats;
            renderCategoryTabs();
          }
        }
      }
    });
  } else {
    renderCategoryTabs();
  }

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === 'FDP_USER_SYNC_BROADCAST') {
        currentStaff = msg.user && msg.user.fullName ? msg.user : null;
        renderStaffState();
      }
      if (msg && msg.type === 'FDP_CATEGORIES_CHANGED' && Array.isArray(msg.categories)) {
        currentCategories = msg.categories;
        renderCategoryTabs();
      }
    });
  }

  // Open App Button
  if (openAppBtn) {
    openAppBtn.addEventListener('click', () => {
      let targetUrl = 'https://cashdrawermanagement.netlify.app/app';
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['frontdesk_app_url'], (res) => {
          if (res && res.frontdesk_app_url) targetUrl = res.frontdesk_app_url;
          window.open(targetUrl, '_blank');
        });
      } else {
        window.open(targetUrl, '_blank');
      }
    });
  }

  // Movable Bubble Drag Logic
  let bubblePos = null;
  try {
    const saved = localStorage.getItem('fdp_bubble_pos');
    if (saved) {
      const p = JSON.parse(saved);
      if (typeof p.x === 'number' && typeof p.y === 'number') {
        bubblePos = {
          x: Math.max(12, Math.min(window.innerWidth - 60, p.x)),
          y: Math.max(12, Math.min(window.innerHeight - 60, p.y))
        };
      }
    }
  } catch (e) {}

  function applyTriggerPosition(x, y) {
    trigger.style.left = `${x}px`;
    trigger.style.top = `${y}px`;
    trigger.style.right = 'auto';
    trigger.style.bottom = 'auto';
  }

  function updateModalPosition(x, y) {
    const isBottomHalf = y > window.innerHeight / 2;
    const isRightHalf = x > window.innerWidth / 2;

    modal.style.top = 'auto';
    modal.style.bottom = 'auto';
    modal.style.left = 'auto';
    modal.style.right = 'auto';

    if (isBottomHalf) {
      modal.style.bottom = `${window.innerHeight - y + 10}px`;
    } else {
      modal.style.top = `${y + 54}px`;
    }

    if (isRightHalf) {
      modal.style.right = `${Math.max(16, window.innerWidth - x - 48)}px`;
    } else {
      modal.style.left = `${Math.max(16, x)}px`;
    }
  }

  if (bubblePos) {
    applyTriggerPosition(bubblePos.x, bubblePos.y);
  }

  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let bubbleStart = { x: 0, y: 0 };
  let hasMoved = false;

  trigger.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    hasMoved = false;
    dragStart = { x: e.clientX, y: e.clientY };

    const rect = trigger.getBoundingClientRect();
    bubbleStart = { x: rect.left, y: rect.top };

    const handlePointerMove = (ev) => {
      if (!isDragging) return;
      const dx = ev.clientX - dragStart.x;
      const dy = ev.clientY - dragStart.y;
      if (Math.hypot(dx, dy) > 4) {
        hasMoved = true;
        trigger.classList.add('dragging');
        const newX = Math.max(12, Math.min(window.innerWidth - 60, bubbleStart.x + dx));
        const newY = Math.max(12, Math.min(window.innerHeight - 60, bubbleStart.y + dy));
        bubblePos = { x: newX, y: newY };
        applyTriggerPosition(newX, newY);
      }
    };

    const handlePointerUp = () => {
      if (!isDragging) return;
      isDragging = false;
      trigger.classList.remove('dragging');
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);

      if (hasMoved && bubblePos) {
        try {
          localStorage.setItem('fdp_bubble_pos', JSON.stringify(bubblePos));
        } catch (e) {}
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  });

  // Toggle Modal on Book Click
  trigger.addEventListener('click', () => {
    if (hasMoved) return;
    const willOpen = !modal.classList.contains('open');
    if (willOpen) {
      modal.classList.add('open');
      trigger.classList.add('book-open');
      const rect = trigger.getBoundingClientRect();
      updateModalPosition(rect.left, rect.top);
    } else {
      modal.classList.remove('open');
      trigger.classList.remove('book-open');
    }
  });

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    modal.classList.remove('open');
    trigger.classList.remove('book-open');
  });

  // Stop host page capture and bubble listeners from interfering with dropdowns and form inputs
  const stopModalInterference = (e) => {
    e.stopPropagation();
  };
  modal.addEventListener('pointerdown', stopModalInterference);
  modal.addEventListener('mousedown', stopModalInterference);
  modal.addEventListener('click', stopModalInterference);

  root.querySelectorAll('select').forEach((sel) => {
    sel.addEventListener('mousedown', stopModalInterference);
    sel.addEventListener('pointerdown', stopModalInterference);
    sel.addEventListener('click', stopModalInterference);
    sel.addEventListener('change', stopModalInterference);
  });

  // Handle Form Submission with JavaScript validation (never blocked by hidden HTML5 fields!)
  function submitQuickLog() {
    const norm = activeCat.trim().toLowerCase();
    const isSales = norm === 'sales';
    const isComp = norm === 'complaint';
    const isMisc = norm === 'miscellaneous' || norm === 'shift note';

    // Validate visible fields
    if (isSales) {
      const salesName = (root.querySelector('#fdp-sales-name')?.value || '').trim();
      const salesPhone = (root.querySelector('#fdp-sales-phone')?.value || '').trim();
      if (!salesName) {
        alert('Please enter Lead / Contact Name.');
        root.querySelector('#fdp-sales-name')?.focus();
        return;
      }
      if (!salesPhone) {
        alert('Please enter Phone number.');
        root.querySelector('#fdp-sales-phone')?.focus();
        return;
      }
    } else if (isComp) {
      const compName = (root.querySelector('#fdp-comp-name')?.value || '').trim();
      const compPhone = (root.querySelector('#fdp-comp-phone')?.value || '').trim();
      if (!compName) {
        alert('Please enter Guest Name.');
        root.querySelector('#fdp-comp-name')?.focus();
        return;
      }
      if (!compPhone) {
        alert('Please enter Phone number.');
        root.querySelector('#fdp-comp-phone')?.focus();
        return;
      }
    } else {
      const customTopic = (root.querySelector('#fdp-misc-topic')?.value || '').trim();
      if (!customTopic) {
        alert('Please enter Task / Item Summary.');
        root.querySelector('#fdp-misc-topic')?.focus();
        return;
      }
    }

    const timestamp = new Date().toISOString();
    const id = `log_ext_${Date.now()}`;
    const clerkId = currentStaff ? currentStaff.id : 'usr_ext_guest';
    const clerkName = currentStaff ? currentStaff.fullName : 'Front Desk Staff';
    const catSaveName = isMisc ? 'Miscellaneous' : activeCat;

    let entry = {
      id,
      category: catSaveName,
      clerkId,
      clerkName,
      clerkNotes: (root.querySelector('#fdp-notes')?.value || '').trim(),
      hasReminder: root.querySelector('#fdp-has-reminder')?.checked || false,
      createdAt: timestamp,
      updatedAt: timestamp,
      responses: []
    };

    if (isSales) {
      const salesSub = root.querySelector('#fdp-sales-subcat')?.value || 'Group';
      const salesName = (root.querySelector('#fdp-sales-name')?.value || '').trim();
      const salesPhone = (root.querySelector('#fdp-sales-phone')?.value || '').trim();
      const salesEmail = (root.querySelector('#fdp-sales-email')?.value || '').trim();
      const salesInVal = root.querySelector('#fdp-sales-in')?.value || '';
      const salesOutVal = root.querySelector('#fdp-sales-out')?.value || '';
      const salesRoomsVal = parseInt(root.querySelector('#fdp-sales-rooms')?.value, 10) || 1;
      const salesStatusVal = root.querySelector('#fdp-sales-status')?.value || 'New Lead';

      let nights = 1;
      if (salesInVal && salesOutVal) {
        const d1 = new Date(salesInVal);
        const d2 = new Date(salesOutVal);
        const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
        if (diff > 0) nights = diff;
      }
      const totalRoomNights = salesRoomsVal * nights;
      const potentialRevenue = totalRoomNights * 120;

      entry = {
        ...entry,
        topic: `Sales Lead: ${salesName || salesSub}`,
        name: salesName,
        phone: salesPhone,
        email: salesEmail || undefined,
        subCategory: salesSub,
        checkInDate: salesInVal || undefined,
        checkOutDate: salesOutVal || undefined,
        roomRequirement: salesRoomsVal,
        totalRoomNights,
        potentialRevenue,
        salesStatus: salesStatusVal,
      };
    } else if (isComp) {
      const compSub = root.querySelector('#fdp-comp-subcat')?.value || 'Room Maintenance';
      const compName = (root.querySelector('#fdp-comp-name')?.value || '').trim();
      const compPhone = (root.querySelector('#fdp-comp-phone')?.value || '').trim();
      const compRoom = (root.querySelector('#fdp-comp-room')?.value || '').trim();
      const compRes = (root.querySelector('#fdp-comp-res')?.value || '').trim();

      entry = {
        ...entry,
        topic: `Complaint: ${compSub} - ${compName || 'Room ' + (compRoom || 'N/A')}`,
        name: compName,
        phone: compPhone,
        phoneNumber: compPhone,
        roomNumber: compRoom || undefined,
        reservationNumber: compRes || undefined,
        complaintStatus: 'Open',
        subCategory: compSub,
      };
    } else {
      const customTopic = (root.querySelector('#fdp-misc-topic')?.value || '').trim();
      const customSub = root.querySelector('#fdp-custom-subcat')?.value || 'General';
      const customName = (root.querySelector('#fdp-custom-name')?.value || '').trim();
      const customRoom = (root.querySelector('#fdp-custom-room')?.value || '').trim();

      entry = {
        ...entry,
        topic: customTopic || (isMisc ? `Shift Note: ${customSub}` : `${activeCat}: ${customSub}`),
        subCategory: customSub,
        name: customName || undefined,
        phoneNumber: undefined,
        roomNumber: customRoom || undefined,
      };

      const customInps = root.querySelectorAll('input[data-custom-qid]');
      if (customInps.length > 0) {
        entry.customFields = {};
        customInps.forEach((ci) => {
          const qid = ci.getAttribute('data-custom-qid');
          if (qid && ci.value) entry.customFields[qid] = ci.value;
        });
      }
    }

    // Save locally into chrome storage
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['frontdesk_logs'], (res) => {
        const logs = res.frontdesk_logs || [];
        logs.unshift(entry);
        chrome.storage.local.set({ frontdesk_logs: logs });

        if (chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ type: 'FDP_LOG_CREATED', log: entry }).catch(() => {});
        }
      });
    }

    try {
      const existing = JSON.parse(localStorage.getItem('frontdesk_external_logs') || '[]');
      existing.unshift(entry);
      localStorage.setItem('frontdesk_external_logs', JSON.stringify(existing));
    } catch (e) {}

    const successBanner = root.querySelector('#fdp-success');
    if (successBanner) {
      successBanner.style.display = 'block';
    }

    setTimeout(() => {
      if (successBanner) successBanner.style.display = 'none';
      form.reset();
      selectCategory(activeCat);
      modal.classList.remove('open');
      trigger.classList.remove('book-open');
    }, 1200);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submitQuickLog();
  });

  const submitBtn = document.getElementById('fdp-submit');
  if (submitBtn) {
    submitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      submitQuickLog();
    });
  }

  // =========================================================================
  // 3. NATIVE BWH RESERVATION BUTTON INJECTOR & DOM AUTOFILL DRIVER
  // =========================================================================
  const MARK = 'data-fdp-injected';
  const MSG_TYPE = 'FRONTDESK_AUTOFILL_LOG';

  function cleanStr(s) {
    return (s || '').replace(/\s+/g, ' ').trim();
  }

  function parseReservationText(text) {
    const t = text || '';
    const out = { guestName: '', phone: '', email: '', room: '', reservation: '' };
    let m;
    if ((m = t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i))) out.email = m[0];
    if ((m = t.match(/(?:\+?1[\s.-]?)?\(?[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4}/))) out.phone = m[0].trim();
    if ((m = t.match(/\b(?:Room|Rm)\s*(?:#|No\.?|Number)?\s*[-:]?\s*([A-Z0-9-]{2,6})\b/i))) out.room = m[1];
    if ((m = t.match(/\b(?:Reservation|Res|Folio|Confirmation)\s*(?:#|No\.?|Number)?\s*[-:]?\s*([A-Z0-9-]{4,})/i))) out.reservation = m[1];
    return out;
  }

  function parseHeaderTitle(s) {
    const parts = (s || '').split('/').map(cleanStr);
    const resNumber = parts[0] || '';
    const guest = parts[1] || '';
    let room = '';
    if (parts[2]) {
      const rmMatch = parts[2].match(/\b(?:Room\s*[-#:]?\s*)?([0-9]{2,5}[A-Za-z]?)\b/i);
      room = rmMatch ? rmMatch[1] : parts[2].replace(/^Room\s*[-#:]?\s*/i, '').split(' ')[0];
    }
    return { reservation: resNumber, guestName: guest, room: room };
  }

  function getLoggedInClerkName() {
    const staffEls = document.querySelectorAll('header .user-name, header [class*="user"], nav [class*="user"], .hk-user-dropdown, .profile-name, [class*="profile"]');
    for (let i = 0; i < staffEls.length; i++) {
      const txt = cleanStr(staffEls[i].textContent);
      if (txt && txt.length > 2 && txt.length < 40 && !/help|folio|guest|stay/i.test(txt)) {
        return txt;
      }
    }
    return '';
  }

  function scrapeActiveReservationData() {
    const data = { guestName: '', phone: '', email: '', room: '', reservation: '' };
    const loggedClerk = getLoggedInClerkName();

    // 1. Primary & Authoritative: Page Title Header (e.g. "14241009477 / JAMES CALVIN ANDERSON / Room - 405 (IN HOUSE)")
    const titleHeadings = document.querySelectorAll('div.date-title h4, h4[data-v-796e4b3f], h4, h3, h2');
    for (let i = 0; i < titleHeadings.length; i++) {
      const headingText = cleanStr(titleHeadings[i].textContent);
      if (headingText.includes('/') && /Room/i.test(headingText)) {
        const parsed = parseHeaderTitle(headingText);
        if (parsed.reservation) data.reservation = parsed.reservation;
        if (parsed.guestName && parsed.guestName !== loggedClerk) data.guestName = parsed.guestName;
        if (parsed.room) data.room = parsed.room;
        if (data.guestName) break;
      }
    }

    // 2. Card Reservation Data (scoped strictly to Guest Tab card, never navbar user menu)
    const guestCards = document.querySelectorAll('div[data-v-75e89ec1].card, div.card');
    let card = null;
    for (let c = 0; c < guestCards.length; c++) {
      const cText = guestCards[c].textContent || '';
      if (/Guarantee Type|Rate Plan|Additional Guests|Remarks/i.test(cText)) {
        card = guestCards[c];
        break;
      }
    }
    if (!card && guestCards.length > 0) card = guestCards[0];

    if (card) {
      if (!data.guestName || data.guestName === loggedClerk) {
        const cardHeadings = card.querySelectorAll('h1, h2, h3, h4, h5, div.fw-600, div[class*="guest"]');
        for (let h = 0; h < cardHeadings.length; h++) {
          const hTxt = cleanStr(cardHeadings[h].textContent);
          if (
            hTxt &&
            hTxt.length > 3 &&
            hTxt.length < 60 &&
            hTxt !== loggedClerk &&
            !/Guarantee|Rate Plan|Source|Local|RACK|Folio|Stay|Remarks/i.test(hTxt) &&
            /^[A-Z\s.'-]+$/i.test(hTxt)
          ) {
            data.guestName = hTxt;
            break;
          }
        }

        if (!data.guestName || data.guestName === loggedClerk) {
          const firstInp = card.querySelector('input[placeholder*="First" i], input[name*="first" i]');
          const lastInp = card.querySelector('input[placeholder*="Last" i], input[name*="last" i]');
          if (firstInp && lastInp && cleanStr(firstInp.value) && cleanStr(lastInp.value)) {
            data.guestName = cleanStr(firstInp.value + ' ' + lastInp.value);
          }
        }
      }

      const phoneEl = card.querySelector('.phone span, [class*="phone"] span, [class*="phone"]');
      if (phoneEl && cleanStr(phoneEl.textContent)) {
        const pMatch = cleanStr(phoneEl.textContent).match(/(?:\+?1[\s.-]?)?\(?[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
        if (pMatch) data.phone = pMatch[0];
      }

      const emailEl = card.querySelector('.hk-tooltip-wrapper span, [class*="email"] span, [class*="email"]');
      if (emailEl && cleanStr(emailEl.textContent)) {
        const eMatch = cleanStr(emailEl.textContent).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
        if (eMatch) data.email = eMatch[0];
      }
    }

    if (!data.phone || !data.email) {
      const scopeText = (card || document.body).innerText || (card || document.body).textContent || '';
      const fallback = parseReservationText(scopeText);
      if (!data.phone && fallback.phone) data.phone = fallback.phone;
      if (!data.email && fallback.email) data.email = fallback.email;
    }

    return data;
  }

  function handleAutofillData(d) {
    if (!d) return;

    if (modal) {
      modal.classList.add('open');
      trigger.classList.add('book-open');
      const rect = trigger.getBoundingClientRect();
      updateModalPosition(rect.left, rect.top);
    }

    if (d.category) {
      selectCategory(d.category);
    }

    const isSales = activeCat.toLowerCase() === 'sales';
    const isComp = activeCat.toLowerCase() === 'complaint';

    if (isComp) {
      const compName = root.querySelector('#fdp-comp-name');
      const compPhone = root.querySelector('#fdp-comp-phone');
      const compRoom = root.querySelector('#fdp-comp-room');
      const compRes = root.querySelector('#fdp-comp-res');
      if (compName && (d.guestName || d.name)) compName.value = d.guestName || d.name;
      if (compPhone && (d.phoneNumber || d.phone)) compPhone.value = d.phoneNumber || d.phone;
      if (compRoom && (d.room || d.roomNumber)) compRoom.value = d.room || d.roomNumber;
      if (compRes && (d.reservation || d.reservationNumber)) compRes.value = d.reservation || d.reservationNumber;
    } else if (isSales) {
      const salesName = root.querySelector('#fdp-sales-name');
      const salesPhone = root.querySelector('#fdp-sales-phone');
      const salesEmail = root.querySelector('#fdp-sales-email');
      if (salesName && (d.guestName || d.name)) salesName.value = d.guestName || d.name;
      if (salesPhone && (d.phoneNumber || d.phone)) salesPhone.value = d.phoneNumber || d.phone;
      if (salesEmail && d.email) salesEmail.value = d.email;
    } else {
      const miscTopic = root.querySelector('#fdp-misc-topic');
      const customName = root.querySelector('#fdp-custom-name');
      const customRoom = root.querySelector('#fdp-custom-room');
      if (miscTopic) miscTopic.value = d.topic || `${activeCat === 'Miscellaneous' ? 'Shift Note' : activeCat}: ${d.guestName || d.name || 'Reservation'}`;
      if (customName && (d.guestName || d.name)) customName.value = d.guestName || d.name;
      if (customRoom && (d.room || d.roomNumber)) customRoom.value = d.room || d.roomNumber;
    }

    if (d.clerkNotes) {
      const notesEl = root.querySelector('#fdp-notes');
      if (notesEl) notesEl.value = d.clerkNotes;
    }

    const successBanner = root.querySelector('#fdp-success');
    if (successBanner) {
      successBanner.textContent = '⚡ Direct Autofill from Reservation Page!';
      successBanner.style.background = '#dbeafe';
      successBanner.style.color = '#1e40af';
      successBanner.style.border = '1px solid #93c5fd';
      successBanner.style.display = 'block';
      setTimeout(() => {
        successBanner.style.display = 'none';
        successBanner.textContent = 'Shift log recorded and synced to register';
        successBanner.style.background = '';
        successBanner.style.color = '';
        successBanner.style.border = '';
      }, 3000);
    }
  }

  function makeInjectedButton(label, logType, targetHeight, targetRadius, targetBorderColor) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute(MARK, logType);
    b.textContent = label;
    b.setAttribute('aria-label', label);

    const h = targetHeight ? `${targetHeight}px` : '32px';
    const r = targetRadius || '4px';
    const bc = targetBorderColor || '#cfd4d9';

    b.style.cssText = [
      `height: ${h} !important`,
      `min-height: ${h} !important`,
      `max-height: ${h} !important`,
      'padding: 0 10px !important',
      `border-radius: ${r} !important`,
      `border: 1px solid ${bc} !important`,
      'background: #ffffff !important',
      'color: #2f3e4e !important',
      'font-family: inherit !important',
      'font-size: 12px !important',
      'line-height: 1 !important',
      'font-weight: 600 !important',
      'cursor: pointer !important',
      'white-space: nowrap !important',
      'display: inline-flex !important',
      'align-items: center !important',
      'justify-content: center !important',
      'vertical-align: middle !important',
      'box-sizing: border-box !important',
      'margin-right: 6px !important',
      'transition: all 0.15s ease !important'
    ].join(';') + ';';

    b.addEventListener('mouseenter', () => {
      b.style.background = logType === 'complaint' ? '#fff1f2' : '#f0f5ff';
      b.style.borderColor = logType === 'complaint' ? '#f43f5e' : '#6366f1';
      b.style.color = logType === 'complaint' ? '#e11d48' : '#4338ca';
    });

    b.addEventListener('mouseleave', () => {
      b.style.background = '#ffffff';
      b.style.borderColor = bc;
      b.style.color = '#2f3e4e';
    });

    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const scraped = scrapeActiveReservationData();
      const category = logType === 'complaint' ? 'Complaint' : 'Miscellaneous';
      const defaultTopic = logType === 'complaint'
        ? (`Guest Complaint: ${scraped.guestName || 'Room ' + (scraped.room || 'N/A')}`)
        : (`Shift Note: ${scraped.guestName || 'Room ' + (scraped.room || 'N/A')}`);

      const payload = {
        category: category,
        topic: defaultTopic,
        name: scraped.guestName || '',
        guestName: scraped.guestName || '',
        phone: scraped.phone || '',
        phoneNumber: scraped.phone || '',
        email: scraped.email || '',
        room: scraped.room || '',
        roomNumber: scraped.room || '',
        reservation: scraped.reservation || '',
        reservationNumber: scraped.reservation || '',
        clerkNotes: `Auto-captured from BWH (${category}). Room ${scraped.room || 'N/A'} • Res #${scraped.reservation || 'N/A'}`
      };

      handleAutofillData(payload);

      window.postMessage({
        type: MSG_TYPE,
        source: 'bwh-frontdesk-web',
        category: category,
        logType: logType,
        data: payload,
        payload: payload
      }, '*');
    });

    return b;
  }

  function findBwhActionGroup() {
    // 1. First look for pencil icon / pen_icon in the guest profile card
    const editIcons = document.querySelectorAll('[data-train-key-id="pen_icon"], [aria-label*="Edit Guest"], .edit-icon');
    for (let i = 0; i < editIcons.length; i++) {
      const icon = editIcons[i];
      const parent = icon.closest('.flexed') || icon.parentElement;
      if (!parent) continue;

      const pText = (parent.parentElement ? parent.parentElement.textContent : '') + ' ' + (parent.textContent || '');
      if (/Guarantee|Rate Plan|Credit Card|Payment|Source|Local|RACK/i.test(pText)) {
        continue;
      }

      return parent;
    }

    // 2. Direct card header actions container
    const headerRow = document.querySelector('div[data-v-75e89ec1].card > div:first-child .flexed, div.card > div:first-child .flexed');
    if (headerRow) return headerRow;

    return null;
  }

  function injectBwhActionButtons() {
    // Remove any duplicate wraps if they exist
    const existingWraps = document.querySelectorAll('span[' + MARK + '="wrap"]');
    if (existingWraps.length > 1) {
      for (let w = 1; w < existingWraps.length; w++) {
        existingWraps[w].remove();
      }
    }

    const group = findBwhActionGroup();
    if (!group) return 0;

    // If buttons are already correctly present inside the valid group, done!
    if (group.querySelector('span[' + MARK + '="wrap"]')) {
      return 1;
    }

    // Clean up wrap if it was in the wrong container
    if (existingWraps.length > 0) {
      existingWraps[0].remove();
    }

    // Anchor: donut refresh icon or first child
    const anchor = group.querySelector('.edit-icon:first-child, [data-train-key-id="guest_dashboard"]') || group.firstElementChild;
    if (!anchor) return 0;

    const computed = window.getComputedStyle ? window.getComputedStyle(anchor) : null;
    const rect = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null;
    const targetHeight = (rect && rect.height > 18)
      ? Math.round(rect.height)
      : ((anchor.offsetHeight && anchor.offsetHeight > 18)
        ? anchor.offsetHeight
        : (computed && parseFloat(computed.height) > 18 ? Math.round(parseFloat(computed.height)) : 30));
    const targetRadius = (computed && computed.borderRadius) || '4px';
    const targetBorderColor = (computed && computed.borderColor) || '#cfd4d9';

    const wrap = document.createElement('span');
    wrap.setAttribute(MARK, 'wrap');
    wrap.setAttribute('data-bwh-logs', '');
    wrap.style.cssText = 'display:inline-flex;align-items:center;vertical-align:middle;margin-right:6px;';

    wrap.appendChild(makeInjectedButton('+ Complaint Log', 'complaint', targetHeight, targetRadius, targetBorderColor));
    wrap.appendChild(makeInjectedButton('+ Misc Log', 'misc', targetHeight, targetRadius, targetBorderColor));

    group.insertBefore(wrap, anchor);
    return 1;
  }

  // Start native DOM injector observer
  function startBwhNativeInjector() {
    injectBwhActionButtons();
    setTimeout(injectBwhActionButtons, 400);
    setTimeout(injectBwhActionButtons, 1200);
    setTimeout(injectBwhActionButtons, 2500);

    const observer = new MutationObserver(() => injectBwhActionButtons());
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
    setInterval(injectBwhActionButtons, 1500);
  }

  startBwhNativeInjector();

  // Listen for custom script execution requests
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg && msg.type === 'EXECUTE_CUSTOM_SCRIPT' && msg.script) {
        try {
          const fn = new Function(msg.script);
          fn();
          sendResponse({ success: true });
        } catch (err) {
          console.error('[FrontDesk Pro] Error running custom script:', err);
          sendResponse({ success: false, error: String(err) });
        }
      }
    });
  }

  // Auto-run custom script if uploaded
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['fdp_custom_script', 'fdp_script_autorun'], (res) => {
      if (res && res.fdp_script_autorun && res.fdp_custom_script) {
        setTimeout(() => {
          try {
            const fn = new Function(res.fdp_custom_script);
            fn();
          } catch (e) {
            console.error('[FrontDesk Pro] Auto-run script error:', e);
          }
        }, 800);
      }
    });
  }

  // Listen for direct postMessage from any other scripts
  window.addEventListener('message', (event) => {
    if (!event.data || typeof event.data !== 'object') return;
    if (event.data.type === 'FRONTDESK_AUTOFILL_LOG' && event.data.data) {
      handleAutofillData(event.data.data);
    }
  });
})();
