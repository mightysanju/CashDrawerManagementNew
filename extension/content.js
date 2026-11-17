// FrontDesk Pro — Floating Shift Log Extension Content Script
(function () {
  const hostname = window.location.hostname;
  const hasAppMeta = !!document.querySelector('meta[name="frontdesk-pro-app"]');
  const isFrontDeskApp =
    hasAppMeta ||
    hostname.includes('cashdrawermanagement') ||
    (hostname.endsWith('netlify.app') && (window.location.pathname.startsWith('/app') || document.title.includes('Cash Drawer') || document.title.includes('FrontDesk'))) ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1';

  // =========================================================================
  // 1. FRONTDESK PRO WEB APP BRIDGE (Runs on cashdrawermanagement.netlify.app & localhost)
  // =========================================================================
  if (isFrontDeskApp) {
    // Automatically register active hosted URL in extension storage so floating bubbles on other tabs link here
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

    // Initial check and periodic verification
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

    // Listen for direct postMessage from React main world (e.g. from authManager or database)
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

      // Purge extension log storage when requested by app during database reset
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

      // Deliver logs when page asks
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

    // Deliver logs on storage update
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

    // Deliver logs from background service worker
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.type === 'FDP_NEW_LOG_BROADCAST' && msg.log) {
          window.postMessage({ type: 'FDP_EXTENSION_LOG_RECEIVED', log: msg.log }, '*');
        }
      });
    }

    // Return here so FrontDesk Pro uses its in-app register without injecting a duplicate bubble
    return;
  }

  // =========================================================================
  // 2. FOR ALL OTHER WEBSITES (Google, OTA Portals, PMS, Booking, CRM, etc.)
  // Render the Floating Quick Log Bubble with Login Verification
  // =========================================================================
  if (document.getElementById('fdp-bubble-root')) return;

  const root = document.createElement('div');
  root.id = 'fdp-bubble-root';
  const mountTarget = document.body || document.documentElement;
  if (!mountTarget) return;
  mountTarget.appendChild(root);

  // Active staff state: NULL by default until authenticated
  let currentStaff = null;

  // Inject UI Skeleton
  root.innerHTML = `
    <!-- Floating Circle Trigger (Animated Log Book) -->
    <div class="fdp-floating-trigger" id="fdp-trigger" title="FrontDesk Pro — Quick Log Shift & Sales Lead">
      <svg class="fdp-logbook-svg logbook-stack-3d" viewBox="0 0 44 48" width="44" height="48" fill="none" xmlns="http://www.w3.org/2000/svg">
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
          <path d="M5 4 H10.5 V43 H5 A2.5 2.5 0 0 1 5 4 Z" fill="#090d16" />
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
      <div class="fdp-header">
        <div class="fdp-header-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
          </svg>
          <span>FrontDesk Pro Quick Log</span>
        </div>
        <button class="fdp-close-btn" id="fdp-close" title="Close">&times;</button>
      </div>

      <!-- Staff Info Bar -->
      <div id="fdp-staff-container"></div>

      <!-- Login Gate (Shown when user is NOT logged in) -->
      <div id="fdp-login-gate" style="display: none; padding: 24px 20px; text-align: center;">
        <div style="width: 48px; height: 48px; margin: 0 auto 12px; background: #eff6ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #2563eb;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <h3 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 6px;">Staff Sign-In Required</h3>
        <p style="font-size: 12px; color: #64748b; margin: 0 0 16px; line-height: 1.45;">
          You must be signed in to your FrontDesk Pro register to record shift logs, guest complaints, and sales leads.
        </p>
        <button id="fdp-open-app-btn" type="button" class="fdp-submit-btn" style="width: 100%; justify-content: center;">
          <span>Sign In to FrontDesk Pro</span>
          <span>&rarr;</span>
        </button>
        <p id="fdp-gate-url-note" style="font-size: 11px; color: #94a3b8; margin: 12px 0 0;">
          Opens https://cashdrawermanagement.netlify.app/app
        </p>
      </div>

      <!-- Form Content (Shown only when user IS logged in) -->
      <div id="fdp-form-container" style="display: none;">
        <div class="fdp-tabs" id="fdp-tabs-bar"></div>

        <form class="fdp-body" id="fdp-form">
          <!-- SALES FIELDS -->
          <div id="fdp-sales-fields">
            <div class="fdp-field">
              <label class="fdp-label">Lead Category</label>
              <select class="fdp-select" id="fdp-sales-subcat">
                <option value="Group">Group Booking</option>
                <option value="Wedding">Wedding Party</option>
                <option value="Sports team">Sports Team</option>
                <option value="Company">Corporate / Company</option>
                <option value="Bus Tour">Bus Tour</option>
                <option value="Family Reunion">Family Reunion</option>
              </select>
            </div>

            <div class="fdp-field" style="margin-top:6px;">
              <label class="fdp-label">Contact / Group Name *</label>
              <input type="text" class="fdp-input" id="fdp-sales-name" required placeholder="e.g. Apex Tech Summit" />
            </div>

            <div class="fdp-grid-2">
              <div class="fdp-field">
                <label class="fdp-label">Phone *</label>
                <input type="tel" class="fdp-input" id="fdp-sales-phone" required placeholder="(555) 000-0000" />
              </div>
              <div class="fdp-field">
                <label class="fdp-label">Email</label>
                <input type="email" class="fdp-input" id="fdp-sales-email" placeholder="client@corp.com" />
              </div>
            </div>

            <div class="fdp-grid-2">
              <div class="fdp-field">
                <label class="fdp-label">Check-In</label>
                <input type="date" class="fdp-input" id="fdp-sales-in" />
              </div>
              <div class="fdp-field">
                <label class="fdp-label">Check-Out</label>
                <input type="date" class="fdp-input" id="fdp-sales-out" />
              </div>
            </div>

            <div class="fdp-grid-2">
              <div class="fdp-field">
                <label class="fdp-label">Rooms</label>
                <input type="number" min="1" value="1" class="fdp-input" id="fdp-sales-rooms" />
              </div>
              <div class="fdp-field">
                <label class="fdp-label">Lead Stage</label>
                <select class="fdp-select" id="fdp-sales-status">
                  <option value="New Lead">New Lead</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Quoted">Quoted</option>
                  <option value="Confirmed">Confirmed</option>
                </select>
              </div>
            </div>

            <div class="fdp-rev-calc">
              <span>Potential Value: </span>
              <span class="fdp-rev-value" id="fdp-est-rev">$120</span>
              <span style="font-size:10px; color:#64748b; margin-left:4px;">(<span id="fdp-est-nights">1</span> room nights)</span>
            </div>
          </div>

          <!-- COMPLAINT FIELDS -->
          <div id="fdp-complaint-fields" style="display: none;">
            <div class="fdp-field">
              <label class="fdp-label">Guest Name *</label>
              <input type="text" class="fdp-input" id="fdp-comp-name" placeholder="e.g. John Doe" />
            </div>

            <div class="fdp-grid-2">
              <div class="fdp-field">
                <label class="fdp-label">Phone *</label>
                <input type="tel" class="fdp-input" id="fdp-comp-phone" placeholder="(555) 000-0000" />
              </div>
              <div class="fdp-field">
                <label class="fdp-label">Room Number</label>
                <input type="text" class="fdp-input" id="fdp-comp-room" placeholder="e.g. 402" />
              </div>
            </div>

            <div class="fdp-field">
              <label class="fdp-label">Reservation / Folio #</label>
              <input type="text" class="fdp-input" id="fdp-comp-res" placeholder="e.g. RES-98432" />
            </div>
          </div>

          <!-- MISCELLANEOUS / CUSTOM CATEGORY FIELDS -->
          <div id="fdp-misc-fields" style="display: none;">
            <div class="fdp-grid-2">
              <div class="fdp-field">
                <label class="fdp-label" id="fdp-misc-topic-label">Task / Item Summary *</label>
                <input type="text" class="fdp-input" id="fdp-misc-topic" placeholder="e.g. Maintenance note" />
              </div>
              <div class="fdp-field">
                <label class="fdp-label">Subcategory *</label>
                <select class="fdp-select" id="fdp-custom-subcat">
                  <option value="General">General</option>
                </select>
              </div>
            </div>

            <div class="fdp-grid-2" style="margin-top:6px;">
              <div class="fdp-field">
                <label class="fdp-label">Staff / Guest Contact (Optional)</label>
                <input type="text" class="fdp-input" id="fdp-custom-name" placeholder="e.g. Staff or guest" />
              </div>
              <div class="fdp-field">
                <label class="fdp-label">Room / Area (Optional)</label>
                <input type="text" class="fdp-input" id="fdp-custom-room" placeholder="e.g. 102" />
              </div>
            </div>

            <div id="fdp-custom-questions-wrap" style="display:none; margin-top:8px; padding:8px 10px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px;">
              <span id="fdp-custom-q-heading" style="font-size:10px; font-weight:700; text-transform:uppercase; color:#1e40af; display:block; margin-bottom:6px;">Additional Fields</span>
              <div id="fdp-custom-questions-list" style="display:grid; grid-template-columns:1fr 1fr; gap:6px;"></div>
            </div>
          </div>

          <!-- COMMON NOTES & REMINDER -->
          <div class="fdp-field" style="margin-top:6px;">
            <label class="fdp-label" id="fdp-notes-label">Staff Notes / Action Taken</label>
            <textarea class="fdp-textarea" id="fdp-notes" placeholder="Detailed handover notes, guest feedback, or follow-up needed..."></textarea>
          </div>

          <div class="fdp-checkbox-row">
            <input type="checkbox" id="fdp-has-reminder" />
            <label for="fdp-has-reminder">Set Reminder for Next Shift / Management</label>
          </div>

          <button type="submit" class="fdp-submit-btn" id="fdp-submit">
            Save Entry to FrontDesk Pro
          </button>

          <div class="fdp-success-banner" id="fdp-success" style="display:none; margin-top:8px;">
            Log entry recorded and synced to register
          </div>
        </form>
      </div>
    </div>
  `;

  // Elements
  const trigger = document.getElementById('fdp-trigger');
  const badge = document.getElementById('fdp-badge');
  const modal = document.getElementById('fdp-modal');
  const closeBtn = document.getElementById('fdp-close');
  const staffContainer = document.getElementById('fdp-staff-container');
  const loginGate = document.getElementById('fdp-login-gate');
  const formContainer = document.getElementById('fdp-form-container');
  const openAppBtn = document.getElementById('fdp-open-app-btn');
  const form = document.getElementById('fdp-form');

  const salesFields = document.getElementById('fdp-sales-fields');
  const compFields = document.getElementById('fdp-complaint-fields');
  const miscFields = document.getElementById('fdp-misc-fields');

  // Default categories in case storage is not populated yet
  const DEFAULT_CATEGORIES = [
    { id: 'cat_sales', name: 'Sales', icon: 'Building2', subcategories: ['Group', 'Wedding', 'Sports team', 'Company', 'Bus Tour', 'Family Reunion'] },
    { id: 'cat_complaint', name: 'Complaint', icon: 'AlertTriangle', subcategories: ['Room Maintenance', 'Noise / Disturbance', 'Billing & Folio', 'Housekeeping / Cleanliness', 'Staff / Service', 'Other'] },
    { id: 'cat_misc', name: 'Miscellaneous', icon: 'Tag', subcategories: ['Shift Handover', 'Package Delivery', 'Lost & Found', 'Maintenance Request', 'Manager Note'] }
  ];

  let currentCategories = [...DEFAULT_CATEGORIES];
  let activeCat = 'Sales';

  // Render Login State inside Bubble
  function renderStaffState() {
    if (currentStaff && currentStaff.fullName) {
      // User IS logged in
      if (badge) {
        badge.style.background = '#10b981';
        badge.title = `Logged in as ${currentStaff.fullName}`;
      }
      staffContainer.innerHTML = `
        <div class="fdp-staff-bar">
          <div>
            <span style="color:#64748b;">Logged in as: </span>
            <strong class="fdp-staff-name" style="color:#0f172a;">${currentStaff.fullName}</strong>
          </div>
          <span class="fdp-staff-role">${currentStaff.role}</span>
        </div>
      `;
      loginGate.style.display = 'none';
      formContainer.style.display = 'block';
    } else {
      // User is NOT logged in
      if (badge) {
        badge.style.background = '#f59e0b';
        badge.title = 'Not Signed In — Click to Sign In';
      }
      staffContainer.innerHTML = `
        <div class="fdp-staff-bar" style="background:#fef3c7; border-bottom:1px solid #fde68a; color:#92400e; display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#d97706;"></span>
            <strong style="font-size:11px; font-weight:600;">Not Signed In to Register</strong>
          </div>
          <span style="font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:0.02em; background:#fde68a; color:#78350f; padding:2px 6px; border-radius:4px;">Guest</span>
        </div>
      `;
      loginGate.style.display = 'block';
      formContainer.style.display = 'none';

      // Update gate URL note from storage
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['frontdesk_app_url'], (res) => {
          const urlNote = document.getElementById('fdp-gate-url-note');
          if (urlNote) {
            const u = res && res.frontdesk_app_url ? res.frontdesk_app_url : 'https://cashdrawermanagement.netlify.app/app';
            urlNote.textContent = `Opens ${u}`;
          }
        });
      }
    }
  }

  function getCategoryEmoji(iconName, catName) {
    const norm = (iconName || catName || '').toLowerCase();
    if (norm.includes('wait') || norm.includes('trophy')) return '🏆';
    if (norm.includes('sale') || norm.includes('build') || norm.includes('lead')) return '🏢';
    if (norm.includes('complaint') || norm.includes('alert') || norm.includes('warn')) return '🏷️';
    if (norm.includes('star')) return '⭐';
    if (norm.includes('bell')) return '🔔';
    if (norm.includes('key')) return '🔑';
    if (norm.includes('dollar') || norm.includes('cash')) return '💵';
    return '🏷️';
  }

  function getCategoryLabel(catName) {
    if (catName === 'Sales') return 'Sales';
    if (catName === 'Complaint') return 'Complaint';
    if (catName === 'Miscellaneous') return 'Shift Note';
    return catName;
  }

  function renderCategoryTabs() {
    const tabsBar = document.getElementById('fdp-tabs-bar');
    if (!tabsBar) return;
    tabsBar.innerHTML = '';

    const list = (currentCategories && currentCategories.length > 0) ? currentCategories : DEFAULT_CATEGORIES;

    // Ensure activeCat exists in list, else default to first
    const hasActive = list.some((c) => c.name.toLowerCase() === activeCat.toLowerCase());
    if (!hasActive && list.length > 0) {
      activeCat = list[0].name;
    }

    list.forEach((cat) => {
      const isSelected = activeCat.toLowerCase() === cat.name.toLowerCase();
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `fdp-tab ${isSelected ? 'active' : ''}`;
      btn.setAttribute('data-cat', cat.name);

      const emojiSpan = document.createElement('span');
      emojiSpan.style.cssText = 'display:inline-block; font-size:12px; margin-right:3px;';
      emojiSpan.textContent = getCategoryEmoji(cat.icon, cat.name);

      const textSpan = document.createElement('span');
      textSpan.textContent = getCategoryLabel(cat.name);

      btn.appendChild(emojiSpan);
      btn.appendChild(textSpan);

      btn.addEventListener('click', () => {
        selectCategory(cat.name);
      });

      tabsBar.appendChild(btn);
    });

    updateFormFieldsForActiveCategory();
  }

  function selectCategory(categoryName) {
    activeCat = categoryName;

    // Update active tab buttons
    const allTabBtns = root.querySelectorAll('.fdp-tab');
    allTabBtns.forEach((tb) => {
      if ((tb.getAttribute('data-cat') || '').toLowerCase() === activeCat.toLowerCase()) {
        tb.classList.add('active');
      } else {
        tb.classList.remove('active');
      }
    });

    updateFormFieldsForActiveCategory();
  }

  function updateFormFieldsForActiveCategory() {
    const isSales = activeCat.toLowerCase() === 'sales';
    const isComp = activeCat.toLowerCase() === 'complaint';
    const isCustom = !isSales && !isComp;

    if (salesFields) salesFields.style.display = isSales ? 'block' : 'none';
    if (compFields) compFields.style.display = isComp ? 'block' : 'none';
    if (miscFields) miscFields.style.display = isCustom ? 'block' : 'none';

    const salesName = document.getElementById('fdp-sales-name');
    const salesPhone = document.getElementById('fdp-sales-phone');
    const compName = document.getElementById('fdp-comp-name');
    const compPhone = document.getElementById('fdp-comp-phone');
    const miscTopic = document.getElementById('fdp-misc-topic');
    const notesLabel = document.getElementById('fdp-notes-label');
    const notesInput = document.getElementById('fdp-notes');
    const submitBtn = document.getElementById('fdp-submit');

    if (submitBtn) {
      if (isSales) submitBtn.textContent = 'Save Entry to FrontDesk Pro';
      else if (isComp) submitBtn.textContent = 'Save Complaint to FrontDesk Pro';
      else submitBtn.textContent = `Save ${activeCat === 'Miscellaneous' ? 'Shift Log' : `${activeCat} Log`}`;
    }

    if (isSales) {
      if (salesName) salesName.required = true;
      if (salesPhone) salesPhone.required = true;
      if (compName) compName.required = false;
      if (compPhone) compPhone.required = false;
      if (miscTopic) miscTopic.required = false;
      if (notesLabel) notesLabel.textContent = 'Staff Notes / Action Taken';
      if (notesInput) notesInput.placeholder = 'Detailed handover notes, deal terms, or follow-up needed...';
    } else if (isComp) {
      if (salesName) salesName.required = false;
      if (salesPhone) salesPhone.required = false;
      if (compName) compName.required = true;
      if (compPhone) compPhone.required = true;
      if (miscTopic) miscTopic.required = false;
      if (notesLabel) notesLabel.textContent = 'Complaint Details / Action Taken';
      if (notesInput) notesInput.placeholder = 'Guest feedback, resolution attempts, or staff notes...';
    } else {
      if (salesName) salesName.required = false;
      if (salesPhone) salesPhone.required = false;
      if (compName) compName.required = false;
      if (compPhone) compPhone.required = false;
      if (miscTopic) miscTopic.required = false;
      if (notesLabel) notesLabel.textContent = 'Details / Observations *';
      if (notesInput) notesInput.placeholder = 'Details, special requests, or handover notes...';

      // Populate subcategories for custom category
      const currentCatObj = currentCategories.find((c) => c.name.toLowerCase() === activeCat.toLowerCase());
      const subcatSelect = document.getElementById('fdp-custom-subcat');
      if (subcatSelect) {
        subcatSelect.innerHTML = '';
        const subs = (currentCatObj && Array.isArray(currentCatObj.subcategories) && currentCatObj.subcategories.length > 0)
          ? currentCatObj.subcategories
          : ['General'];
        subs.forEach((s) => {
          const opt = document.createElement('option');
          opt.value = s;
          opt.textContent = s;
          subcatSelect.appendChild(opt);
        });
      }

      // Populate custom questionnaire questions if defined
      const qWrap = document.getElementById('fdp-custom-questions-wrap');
      const qList = document.getElementById('fdp-custom-questions-list');
      if (qWrap && qList) {
        qList.innerHTML = '';
        const standardIds = new Set(['guestName', 'phoneNumber', 'email', 'roomRequirement', 'dates', 'clerkNotes', 'reminder', 'roomNumber', 'reservationNumber', 'topic', 'subCategory']);
        const customQuestions = (currentCatObj?.questionnaire || []).filter((q) => !standardIds.has(q.id) && q.enabled !== false);

        if (customQuestions.length > 0) {
          qWrap.style.display = 'block';
          const heading = document.getElementById('fdp-custom-q-heading');
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
            inp.required = !!q.required;

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

  // Initial staff & categories load from chrome storage
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['frontdesk_user', 'frontdesk_categories'], (res) => {
      currentStaff = res && res.frontdesk_user && res.frontdesk_user.fullName ? res.frontdesk_user : null;
      if (res && Array.isArray(res.frontdesk_categories) && res.frontdesk_categories.length > 0) {
        currentCategories = res.frontdesk_categories;
      }
      renderStaffState();
      renderCategoryTabs();
    });

    // Listen for storage changes in real time
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

  // Listen for broadcast messages from background
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

  // Movable Bubble Drag-and-Drop Implementation
  let bubblePos = null;
  let isDragging = false;
  let hasMoved = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let bubbleStartX = 0;
  let bubbleStartY = 0;

  function updateModalPosition(x, y) {
    if (!modal) return;
    const isBottomHalf = y > window.innerHeight / 2;
    const isRightHalf = x > window.innerWidth / 2;

    if (isBottomHalf) {
      modal.style.bottom = (window.innerHeight - y + 12) + 'px';
      modal.style.top = 'auto';
    } else {
      modal.style.top = (y + 56) + 'px';
      modal.style.bottom = 'auto';
    }

    if (isRightHalf) {
      modal.style.right = Math.max(16, window.innerWidth - x - 48) + 'px';
      modal.style.left = 'auto';
    } else {
      modal.style.left = Math.max(16, x) + 'px';
      modal.style.right = 'auto';
    }
  }

  function applyBubblePosition(x, y) {
    const clampedX = Math.max(12, Math.min(window.innerWidth - 60, x));
    const clampedY = Math.max(12, Math.min(window.innerHeight - 60, y));
    bubblePos = { x: clampedX, y: clampedY };
    trigger.style.left = clampedX + 'px';
    trigger.style.top = clampedY + 'px';
    trigger.style.right = 'auto';
    trigger.style.bottom = 'auto';
    updateModalPosition(clampedX, clampedY);
  }

  // Load saved position from chrome.storage or localStorage
  function loadSavedBubblePos() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['fdp_bubble_pos'], (res) => {
        if (res && res.fdp_bubble_pos && typeof res.fdp_bubble_pos.x === 'number') {
          applyBubblePosition(res.fdp_bubble_pos.x, res.fdp_bubble_pos.y);
          return;
        }
        checkLocalStoragePos();
      });
    } else {
      checkLocalStoragePos();
    }
  }

  function checkLocalStoragePos() {
    try {
      const saved = localStorage.getItem('fdp_bubble_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          applyBubblePosition(parsed.x, parsed.y);
          return;
        }
      }
    } catch {
      // ignore
    }
    applyBubblePosition(window.innerWidth - 72, window.innerHeight - 72);
  }

  loadSavedBubblePos();

  window.addEventListener('resize', () => {
    if (bubblePos) {
      applyBubblePosition(bubblePos.x, bubblePos.y);
    }
  });

  trigger.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    hasMoved = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const current = bubblePos || { x: window.innerWidth - 72, y: window.innerHeight - 72 };
    bubbleStartX = current.x;
    bubbleStartY = current.y;

    trigger.classList.add('dragging');

    function onPointerMove(ev) {
      if (!isDragging) return;
      const dx = ev.clientX - dragStartX;
      const dy = ev.clientY - dragStartY;
      if (Math.hypot(dx, dy) > 4) {
        hasMoved = true;
        applyBubblePosition(bubbleStartX + dx, bubbleStartY + dy);
      }
    }

    function onPointerUp() {
      if (!isDragging) return;
      isDragging = false;
      trigger.classList.remove('dragging');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      if (hasMoved) {
        if (bubblePos) {
          try {
            localStorage.setItem('fdp_bubble_pos', JSON.stringify(bubblePos));
          } catch {
            // ignore
          }
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ fdp_bubble_pos: bubblePos });
          }
        }
      } else {
        const isOpen = modal.classList.toggle('open');
        trigger.classList.toggle('book-open', isOpen);
      }
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  });

  closeBtn.addEventListener('click', () => {
    modal.classList.remove('open');
    trigger.classList.remove('book-open');
  });

  // Calculate live revenue
  function updateRevenue() {
    const checkIn = document.getElementById('fdp-sales-in').value;
    const checkOut = document.getElementById('fdp-sales-out').value;
    const rooms = parseInt(document.getElementById('fdp-sales-rooms').value, 10) || 1;

    let nights = 1;
    if (checkIn && checkOut) {
      const d1 = new Date(checkIn);
      const d2 = new Date(checkOut);
      const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
      if (diff > 0) nights = diff;
    }

    const totalNights = nights * rooms;
    const estRev = totalNights * 120;

    document.getElementById('fdp-est-nights').textContent = totalNights;
    document.getElementById('fdp-est-rev').textContent = `$${estRev.toLocaleString()}`;
  }

  document.getElementById('fdp-sales-in').addEventListener('change', updateRevenue);
  document.getElementById('fdp-sales-out').addEventListener('change', updateRevenue);
  document.getElementById('fdp-sales-rooms').addEventListener('input', updateRevenue);

  // Form submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    if (!currentStaff) {
      alert('Please sign in to FrontDesk Pro first.');
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['frontdesk_app_url'], (res) => {
          const target = (res && res.frontdesk_app_url) || 'https://cashdrawermanagement.netlify.app/app';
          window.open(target, '_blank');
        });
      } else {
        window.open('https://cashdrawermanagement.netlify.app/app', '_blank');
      }
      return;
    }

    const timestamp = new Date().toISOString();
    const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const notes = document.getElementById('fdp-notes').value.trim();
    const hasReminder = document.getElementById('fdp-has-reminder').checked;

    let entry = {
      id,
      category: activeCat,
      clerkId: (currentStaff && currentStaff.id) || 'usr_staff',
      clerkName: (currentStaff && currentStaff.fullName) || 'Front Desk Staff',
      clerkNotes: notes,
      hasReminder,
      createdAt: timestamp,
      updatedAt: timestamp,
      responses: [],
    };

    if (activeCat === 'Sales') {
      const checkIn = document.getElementById('fdp-sales-in').value;
      const checkOut = document.getElementById('fdp-sales-out').value;
      const rooms = parseInt(document.getElementById('fdp-sales-rooms').value, 10) || 1;
      let nights = 1;
      if (checkIn && checkOut) {
        const d1 = new Date(checkIn);
        const d2 = new Date(checkOut);
        const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
        if (diff > 0) nights = diff;
      }
      const totalRoomNights = nights * rooms;
      const potentialRevenue = totalRoomNights * 120;

      entry = {
        ...entry,
        name: document.getElementById('fdp-sales-name').value.trim(),
        phone: document.getElementById('fdp-sales-phone').value.trim(),
        email: document.getElementById('fdp-sales-email').value.trim(),
        subCategory: document.getElementById('fdp-sales-subcat').value,
        checkInDate: checkIn || undefined,
        checkOutDate: checkOut || undefined,
        roomRequirement: rooms,
        totalRoomNights,
        potentialRevenue,
        salesStatus: document.getElementById('fdp-sales-status').value,
      };
    } else if (activeCat === 'Complaint') {
      entry = {
        ...entry,
        name: document.getElementById('fdp-comp-name').value.trim(),
        phone: document.getElementById('fdp-comp-phone').value.trim(),
        roomNumber: document.getElementById('fdp-comp-room').value.trim() || undefined,
        reservationNumber: document.getElementById('fdp-comp-res').value.trim() || undefined,
        complaintStatus: 'Open',
      };
    } else {
      const topicVal = document.getElementById('fdp-misc-topic') ? document.getElementById('fdp-misc-topic').value.trim() : '';
      const customSub = document.getElementById('fdp-custom-subcat') ? document.getElementById('fdp-custom-subcat').value : 'General';
      const customName = document.getElementById('fdp-custom-name') ? document.getElementById('fdp-custom-name').value.trim() : '';
      const customRoom = document.getElementById('fdp-custom-room') ? document.getElementById('fdp-custom-room').value.trim() : '';

      const customInputs = root.querySelectorAll('#fdp-custom-questions-list input[data-custom-qid]');
      const responses = [];
      customInputs.forEach((inp) => {
        const qid = inp.getAttribute('data-custom-qid');
        const val = inp.value.trim();
        if (val) {
          responses.push({ questionId: qid, answer: val });
        }
      });

      entry = {
        ...entry,
        topic: topicVal || `${activeCat} Log`,
        subCategory: customSub,
        name: customName || undefined,
        roomNumber: customRoom || undefined,
        responses: responses.length > 0 ? responses : [],
      };
    }

    // 1. Save to chrome.storage.local
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['frontdesk_logs'], (res) => {
        const existing = (res && res.frontdesk_logs) || [];
        existing.unshift(entry);
        chrome.storage.local.set({ frontdesk_logs: existing.slice(0, 100) });
      });
    }

    // 2. Broadcast via background service worker to all tabs (especially Netlify / localhost)
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'FDP_LOG_CREATED', log: entry }).catch(() => {});
    }

    // Show success
    const successBanner = document.getElementById('fdp-success');
    successBanner.style.display = 'block';

    setTimeout(() => {
      form.reset();
      updateRevenue();
      successBanner.style.display = 'none';
      modal.classList.remove('open');
      trigger.classList.remove('book-open');
    }, 1200);
  });

  // =========================================================================
  // 3. DOM SCRIPT RUNNER & RESERVATION DIRECT AUTOFILL BRIDGE
  // =========================================================================
  function injectAndRunScript(scriptCode) {
    if (!scriptCode || typeof scriptCode !== 'string') return;
    try {
      const scriptEl = document.createElement('script');
      scriptEl.textContent = `(function() { try { ${scriptCode} } catch(err) { console.error('[FrontDesk Pro Script Error]:', err); } })();`;
      (document.head || document.documentElement).appendChild(scriptEl);
      scriptEl.remove();
    } catch (err) {
      console.error('[FrontDesk Pro] Failed to inject custom script:', err);
    }
  }

  // Listen for execution commands from extension popup
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg && msg.type === 'EXECUTE_CUSTOM_SCRIPT' && msg.script) {
        injectAndRunScript(msg.script);
        sendResponse({ success: true });
      }
    });
  }

  // Check if auto-run is enabled for reservation pages
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['fdp_custom_script', 'fdp_script_autorun'], (res) => {
      if (res && res.fdp_script_autorun && res.fdp_custom_script) {
        // Run after DOM has settled
        setTimeout(() => {
          injectAndRunScript(res.fdp_custom_script);
        }, 1200);
      }
    });
  }

  // Listen for direct postMessage from injected script to autofill floating modal
  window.addEventListener('message', (event) => {
    if (!event.data || typeof event.data !== 'object') return;

    if (event.data.type === 'FRONTDESK_AUTOFILL_LOG' && event.data.data) {
      const d = event.data.data;

      // Open the floating bubble modal
      if (modal) {
        modal.classList.add('open');
        trigger.classList.add('book-open');
        updateModalPosition(bubblePos ? bubblePos.x : window.innerWidth - 60, bubblePos ? bubblePos.y : window.innerHeight - 60);
      }

      // Switch category tab if provided
      if (d.category) {
        selectCategory(d.category);
      }

      // Populate input fields
      const isSales = activeCat.toLowerCase() === 'sales';
      const isComp = activeCat.toLowerCase() === 'complaint';

      if (isComp) {
        const compName = document.getElementById('fdp-comp-name');
        const compPhone = document.getElementById('fdp-comp-phone');
        const compRoom = document.getElementById('fdp-comp-room');
        const compRes = document.getElementById('fdp-comp-res');
        if (compName && (d.guestName || d.name)) compName.value = d.guestName || d.name;
        if (compPhone && (d.phoneNumber || d.phone)) compPhone.value = d.phoneNumber || d.phone;
        if (compRoom && (d.room || d.roomNumber)) compRoom.value = d.room || d.roomNumber;
        if (compRes && (d.reservation || d.reservationNumber)) compRes.value = d.reservation || d.reservationNumber;
      } else if (isSales) {
        const salesName = document.getElementById('fdp-sales-name');
        const salesPhone = document.getElementById('fdp-sales-phone');
        const salesEmail = document.getElementById('fdp-sales-email');
        if (salesName && (d.guestName || d.name)) salesName.value = d.guestName || d.name;
        if (salesPhone && (d.phoneNumber || d.phone)) salesPhone.value = d.phoneNumber || d.phone;
        if (salesEmail && d.email) salesEmail.value = d.email;
      } else {
        const miscTopic = document.getElementById('fdp-misc-topic');
        const customName = document.getElementById('fdp-custom-name');
        const customRoom = document.getElementById('fdp-custom-room');
        if (miscTopic) miscTopic.value = `${activeCat}: ${d.guestName || d.name || 'Reservation'}`;
        if (customName && (d.guestName || d.name)) customName.value = d.guestName || d.name;
        if (customRoom && (d.room || d.roomNumber)) customRoom.value = d.room || d.roomNumber;
      }

      if (d.clerkNotes) {
        const notesEl = document.getElementById('fdp-notes');
        if (notesEl) notesEl.value = d.clerkNotes;
      }

      // Show temporary autofill indicator
      const successBanner = document.getElementById('fdp-success');
      if (successBanner) {
        successBanner.textContent = '⚡ Direct Autofill from Reservation Page DOM!';
        successBanner.style.background = '#dbeafe';
        successBanner.style.color = '#1e40af';
        successBanner.style.border = '1px solid #93c5fd';
        successBanner.style.display = 'block';
        setTimeout(() => {
          successBanner.style.display = 'none';
          successBanner.textContent = 'Log entry recorded and synced to register';
          successBanner.style.background = '';
          successBanner.style.color = '';
          successBanner.style.border = '';
        }, 3000);
      }
    }
  });

  // =========================================================================
  // 4. BUILT-IN NATIVE BWH FRONTDESK WEB RESERVATION BUTTON INJECTOR
  // =========================================================================
  function initBwhReservationAutoInjector() {
    const isBwh = window.location.hostname.includes('bwh') || 
                  window.location.hostname.includes('hkclients') || 
                  window.location.href.includes('frontdesk-web');

    function cleanStr(s) {
      return (s || '').replace(/\s+/g, ' ').trim();
    }

    function parseBwhData() {
      const out = { guestName: '', phone: '', email: '', room: '', reservation: '' };
      const card = document.querySelector('div[data-v-75e89ec1].card') || document.querySelector('div[data-v-75e89ec1]');

      // 1. Primary: Page Title Header (e.g. "14241009477 / JAMES CALVIN ANDERSON / Room - 405 (IN HOUSE)")
      const titleEl = document.querySelector('div.date-title h4, h4[data-v-796e4b3f]');
      if (titleEl) {
        const parts = cleanStr(titleEl.textContent).split('/').map(cleanStr);
        if (parts[0]) out.reservation = parts[0];
        if (parts[1]) out.guestName = parts[1];
        if (parts[2]) {
          const rmMatch = parts[2].match(/\b(?:Room\s*[-#:]?\s*)?([0-9]{2,5}[A-Za-z]?)\b/i);
          out.room = rmMatch ? rmMatch[1] : parts[2].replace(/^Room\s*[-#:]?\s*/i, '').split(' ')[0];
        }
      }

      // 2. Card Reservation Data (scoped strictly to card, never navbar user)
      if (card) {
        const cardName = card.querySelector('span.user-name, div.fw-600 span.user-name');
        if (cardName && cleanStr(cardName.textContent)) {
          out.guestName = cleanStr(cardName.textContent);
        }

        const phoneEl = card.querySelector('.user-info .email-phone > div.phone > span, div.phone > span');
        if (phoneEl && cleanStr(phoneEl.textContent)) out.phone = cleanStr(phoneEl.textContent);

        const emailEl = card.querySelector('.user-info .email-phone > div:not(.phone) .hk-tooltip-wrapper span, .email-phone span');
        if (emailEl && cleanStr(emailEl.textContent)) out.email = cleanStr(emailEl.textContent);
      }

      // 3. Fallbacks
      if (!out.phone || !out.email) {
        const text = (card || document.body).innerText || '';
        const em = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
        if (!out.email && em) out.email = em[0];
        const ph = text.match(/(?:\+?1[\s.-]?)?\(?[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
        if (!out.phone && ph) out.phone = ph[0].trim();
      }

      return out;
    }

    function createBwhButton(label, logType) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-fdp-injected', logType);
      btn.textContent = label;
      btn.style.cssText = [
        'padding: 4px 10px',
        'border-radius: 4px',
        'border: 1px solid #cfd4d9',
        'background: #ffffff',
        'color: #2f3e4e',
        'font-family: inherit',
        'font-size: 12px',
        'line-height: 1.2',
        'font-weight: 600',
        'cursor: pointer',
        'white-space: nowrap',
        'display: inline-flex',
        'align-items: center',
        'box-sizing: border-box',
        'margin-right: 6px',
        'transition: all 0.15s ease'
      ].join(';') + ';';

      btn.addEventListener('mouseenter', () => {
        btn.style.background = logType === 'complaint' ? '#fff1f2' : '#f0f5ff';
        btn.style.borderColor = logType === 'complaint' ? '#f43f5e' : '#6366f1';
        btn.style.color = logType === 'complaint' ? '#e11d48' : '#4338ca';
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.background = '#ffffff';
        btn.style.borderColor = '#cfd4d9';
        btn.style.color = '#2f3e4e';
      });

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const data = parseBwhData();
        const category = logType === 'complaint' ? 'Complaint' : 'Miscellaneous';
        const payload = {
          category: category,
          name: data.guestName,
          phone: data.phone,
          phoneNumber: data.phone,
          email: data.email,
          room: data.room,
          roomNumber: data.room,
          reservation: data.reservation,
          reservationNumber: data.reservation,
          clerkNotes: `Auto-captured from BWH (${category}). Room ${data.room || 'N/A'} • Res #${data.reservation || 'N/A'}`
        };

        window.postMessage({
          type: 'FRONTDESK_AUTOFILL_LOG',
          category: category,
          data: payload,
          payload: payload
        }, '*');
      });

      return btn;
    }

    function injectBwhButtons() {
      // Clean up any stray buttons placed in Guarantee Type or other rows
      const allWraps = document.querySelectorAll('span[data-fdp-injected="wrap"]');
      allWraps.forEach((w) => {
        if (!w.parentElement || !w.parentElement.querySelector('[aria-label*="Edit"], [data-train-key-id="pen_icon"]')) {
          w.remove();
        }
      });

      // Target ONLY the top-right header action buttons row containing the edit icon
      const editIcon = document.querySelector('div[data-v-75e89ec1] [aria-label*="Edit"], div[data-v-75e89ec1] [data-train-key-id="pen_icon"]');
      const actionGroup = editIcon ? editIcon.closest('.flexed') : null;

      if (actionGroup) {
        if (actionGroup.querySelector('[data-fdp-injected]')) return;
        const anchor = actionGroup.querySelector('.edit-icon:first-child, [data-train-key-id="guest_dashboard"]') || actionGroup.firstElementChild;
        if (!anchor) return;

        const wrap = document.createElement('span');
        wrap.setAttribute('data-fdp-injected', 'wrap');
        wrap.style.cssText = 'display:inline-flex;align-items:center;vertical-align:middle;';
        wrap.appendChild(createBwhButton('+ Complaint Log', 'complaint'));
        wrap.appendChild(createBwhButton('+ Misc Log', 'misc'));
        actionGroup.insertBefore(wrap, anchor);
      }
    }

    injectBwhButtons();
    const observer = new MutationObserver(() => injectBwhButtons());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Run auto-injector if on BWH / PMS or if DOM element exists
  setTimeout(initBwhReservationAutoInjector, 800);
})();
