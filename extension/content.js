// FrontDesk Pro — Floating Shift Log Extension Content Script
(function () {
  const isFrontDeskPage =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    document.title.includes('FrontDesk') ||
    !!document.getElementById('root');

  // Sync / Login state
  let currentStaff = {
    id: 'usr_clerk1',
    fullName: 'Front Desk Clerk',
    role: 'clerk',
  };

  // If this is the FrontDesk Pro Dashboard page, act as the Live Sync Bridge!
  if (isFrontDeskPage) {
    // 1. Sync active user from FrontDesk Pro session to extension storage
    try {
      const rawUser = localStorage.getItem('cdm_session_user') || localStorage.getItem('frontdesk_auth_session');
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        const userObj = parsed.user || parsed;
        if (userObj && userObj.id) {
          currentStaff = userObj;
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ frontdesk_user: currentStaff });
          }
        }
      }
    } catch {
      // Ignore parse errors
    }

    // 2. Listen for user sign-in/switch events from FrontDesk Pro
    window.addEventListener('FDP_APP_USER_SYNC', (e) => {
      const user = e.detail;
      if (user && user.id) {
        currentStaff = user;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ frontdesk_user: user });
        }
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ type: 'FDP_USER_CHANGED', user }).catch(() => {});
        }
      }
    });

    // 3. Deliver pending logs to FrontDesk Pro IndexedDB
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['frontdesk_logs'], (res) => {
        if (res && Array.isArray(res.frontdesk_logs) && res.frontdesk_logs.length > 0) {
          window.dispatchEvent(
            new CustomEvent('FDP_EXTENSION_LOGS_SYNC', {
              detail: res.frontdesk_logs,
            })
          );
        }
      });

      // 4. Live listener for logs arriving from other browser tabs
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.frontdesk_logs) {
          const newLogs = changes.frontdesk_logs.newValue || [];
          const oldLogs = changes.frontdesk_logs.oldValue || [];
          if (newLogs.length > 0 && (!oldLogs.length || newLogs[0]?.id !== oldLogs[0]?.id)) {
            window.dispatchEvent(
              new CustomEvent('FDP_EXTENSION_LOG_RECEIVED', {
                detail: newLogs[0],
              })
            );
          }
        }
      });
    }

    // 5. Background message receiver
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.type === 'FDP_NEW_LOG_BROADCAST' && msg.log) {
          window.dispatchEvent(
            new CustomEvent('FDP_EXTENSION_LOG_RECEIVED', {
              detail: msg.log,
            })
          );
        }
      });
    }

    // Return here so FrontDesk Pro page uses its native in-app React bubble without duplicate trigger
    return;
  }

  // -------------------------------------------------------------
  // FOR ALL OTHER WEBSITES (Google, OTA Portals, PMS, Booking, etc.)
  // Render the Floating Quick Log Bubble
  // -------------------------------------------------------------
  if (document.getElementById('fdp-bubble-root')) return;

  const root = document.createElement('div');
  root.id = 'fdp-bubble-root';
  document.body.appendChild(root);

  // Check stored active staff
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['frontdesk_user'], (res) => {
      if (res && res.frontdesk_user) {
        currentStaff = res.frontdesk_user;
        updateStaffBar();
      }
    });
  }

  // Listen for user updates from background
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === 'FDP_USER_SYNC_BROADCAST' && msg.user) {
        currentStaff = msg.user;
        updateStaffBar();
      }
    });
  }

  // Inject UI
  root.innerHTML = `
    <!-- Floating Circle Trigger -->
    <div class="fdp-floating-trigger" id="fdp-trigger" title="FrontDesk Pro — Quick Log Shift & Sales Lead">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="12" y1="18" x2="12" y2="12"></line>
        <line x1="9" y1="15" x2="15" y2="15"></line>
      </svg>
      <div class="fdp-trigger-badge" title="Live Synced"></div>
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

      <div class="fdp-staff-bar">
        <div>
          <span style="color:#64748b;">Logged in as: </span>
          <span class="fdp-staff-name" id="fdp-staff-name">${currentStaff.fullName}</span>
        </div>
        <span class="fdp-staff-role" id="fdp-staff-role">${currentStaff.role}</span>
      </div>

      <div class="fdp-tabs">
        <button class="fdp-tab active" data-cat="Sales">🏢 Sales Lead</button>
        <button class="fdp-tab" data-cat="Complaint">⚠️ Complaint</button>
        <button class="fdp-tab" data-cat="Miscellaneous">📝 Shift Note</button>
      </div>

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

        <!-- MISCELLANEOUS / SHIFT NOTES -->
        <div id="fdp-misc-fields" style="display: none;">
          <div class="fdp-field">
            <label class="fdp-label">Topic / Subject *</label>
            <input type="text" class="fdp-input" id="fdp-misc-topic" placeholder="e.g. Package delivery for Rm 204" />
          </div>
        </div>

        <!-- COMMON NOTES & REMINDER -->
        <div class="fdp-field" style="margin-top:6px;">
          <label class="fdp-label">Staff Notes / Action Taken</label>
          <textarea class="fdp-textarea" id="fdp-notes" placeholder="Detailed handover notes, guest feedback, or follow-up needed..."></textarea>
        </div>

        <div class="fdp-checkbox-row">
          <input type="checkbox" id="fdp-has-reminder" />
          <label for="fdp-has-reminder">Set Reminder for Next Shift / Management</label>
        </div>

        <button type="submit" class="fdp-submit-btn" id="fdp-submit">
          Save Entry to FrontDesk Pro
        </button>

        <div class="fdp-success-banner" id="fdp-success">
          ✓ Log entry saved & synced to FrontDesk Pro!
        </div>
      </form>
    </div>
  `;

  // Elements
  const trigger = document.getElementById('fdp-trigger');
  const modal = document.getElementById('fdp-modal');
  const closeBtn = document.getElementById('fdp-close');
  const form = document.getElementById('fdp-form');
  const tabs = root.querySelectorAll('.fdp-tab');

  const salesFields = document.getElementById('fdp-sales-fields');
  const compFields = document.getElementById('fdp-complaint-fields');
  const miscFields = document.getElementById('fdp-misc-fields');

  let activeCat = 'Sales';

  function updateStaffBar() {
    const nameEl = document.getElementById('fdp-staff-name');
    const roleEl = document.getElementById('fdp-staff-role');
    if (nameEl) nameEl.textContent = currentStaff.fullName;
    if (roleEl) roleEl.textContent = currentStaff.role;
  }

  // Toggle open/close with .open class
  trigger.addEventListener('click', () => {
    modal.classList.toggle('open');
  });

  closeBtn.addEventListener('click', () => {
    modal.classList.remove('open');
  });

  // Tab switching
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      activeCat = tab.getAttribute('data-cat');

      salesFields.style.display = activeCat === 'Sales' ? 'block' : 'none';
      compFields.style.display = activeCat === 'Complaint' ? 'block' : 'none';
      miscFields.style.display = activeCat === 'Miscellaneous' ? 'block' : 'none';

      const salesName = document.getElementById('fdp-sales-name');
      const salesPhone = document.getElementById('fdp-sales-phone');
      const compName = document.getElementById('fdp-comp-name');
      const compPhone = document.getElementById('fdp-comp-phone');
      const miscTopic = document.getElementById('fdp-misc-topic');

      if (activeCat === 'Sales') {
        salesName.required = true;
        salesPhone.required = true;
        compName.required = false;
        compPhone.required = false;
        miscTopic.required = false;
      } else if (activeCat === 'Complaint') {
        salesName.required = false;
        salesPhone.required = false;
        compName.required = true;
        compPhone.required = true;
        miscTopic.required = false;
      } else {
        salesName.required = false;
        salesPhone.required = false;
        compName.required = false;
        compPhone.required = false;
        miscTopic.required = true;
      }
    });
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

    const timestamp = new Date().toISOString();
    const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const notes = document.getElementById('fdp-notes').value.trim();
    const hasReminder = document.getElementById('fdp-has-reminder').checked;

    let entry = {
      id,
      category: activeCat,
      clerkId: currentStaff.id,
      clerkName: currentStaff.fullName,
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
      entry = {
        ...entry,
        topic: document.getElementById('fdp-misc-topic').value.trim(),
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

    // 2. Broadcast via background service worker
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
    }, 1200);
  });
})();
