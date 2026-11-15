// FrontDesk Pro — Floating Shift Log Extension Content Script
(function () {
  if (document.getElementById('fdp-bubble-root')) return;

  const root = document.createElement('div');
  root.id = 'fdp-bubble-root';
  document.body.appendChild(root);

  // Sync / Login state
  let currentStaff = {
    id: 'usr_clerk1',
    fullName: 'Front Desk Clerk',
    role: 'clerk',
  };

  // Check if active user is stored in chrome storage or local storage
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['frontdesk_user'], (res) => {
      if (res && res.frontdesk_user) {
        currentStaff = res.frontdesk_user;
        updateStaffBar();
      }
    });
  }

  // Also check if current site is FrontDesk Pro
  try {
    const rawAuth = localStorage.getItem('frontdesk_auth_session');
    if (rawAuth) {
      const parsed = JSON.parse(rawAuth);
      if (parsed.user) {
        currentStaff = parsed.user;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ frontdesk_user: currentStaff });
        }
      }
    }
  } catch (e) {}

  // P2P Channel for instant live synchronization
  let p2pChannel = null;
  try {
    p2pChannel = new BroadcastChannel('p2p_sync_channel');
  } catch (e) {}

  // Inject UI
  root.innerHTML = `
    <!-- Floating Circle Trigger -->
    <div class="fdp-floating-trigger" id="fdp-trigger" title="FrontDesk Pro — Log Shift / Lead">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="12" y1="18" x2="12" y2="12"></line>
        <line x1="9" y1="15" x2="15" y2="15"></line>
      </svg>
      <div class="fdp-trigger-badge"></div>
    </div>

    <!-- Floating Form Modal -->
    <div class="fdp-modal-overlay" id="fdp-modal" style="display: none;">
      <div class="fdp-header">
        <div class="fdp-header-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
          </svg>
          <span>FrontDesk Pro Quick Log</span>
        </div>
        <button class="fdp-close-btn" id="fdp-close">&times;</button>
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
            </select>
          </div>

          <div class="fdp-field" style="margin-top:6px;">
            <label class="fdp-label">Contact / Group Name *</label>
            <input class="fdp-input" id="fdp-sales-name" required placeholder="e.g. Miller Wedding Block" />
          </div>

          <div class="fdp-row" style="margin-top:6px;">
            <div class="fdp-field">
              <label class="fdp-label">Phone Number *</label>
              <input class="fdp-input" id="fdp-sales-phone" required placeholder="(555) 000-0000" />
            </div>
            <div class="fdp-field">
              <label class="fdp-label">Email Address *</label>
              <input class="fdp-input" type="email" id="fdp-sales-email" required placeholder="name@domain.com" />
            </div>
          </div>

          <div class="fdp-row" style="margin-top:6px;">
            <div class="fdp-field">
              <label class="fdp-label">Check-in</label>
              <input class="fdp-input" type="date" id="fdp-sales-in" />
            </div>
            <div class="fdp-field">
              <label class="fdp-label">Check-out</label>
              <input class="fdp-input" type="date" id="fdp-sales-out" />
            </div>
          </div>

          <div class="fdp-row" style="margin-top:6px;">
            <div class="fdp-field">
              <label class="fdp-label">Rooms</label>
              <input class="fdp-input" type="number" min="1" id="fdp-sales-rooms" placeholder="10" />
            </div>
            <div class="fdp-field">
              <label class="fdp-label">Status</label>
              <select class="fdp-select" id="fdp-sales-status">
                <option value="New Lead">1. New Lead</option>
                <option value="Processing">2. Processing</option>
                <option value="Closed Definite">3. Definite (Won)</option>
                <option value="Lost">4. Lost</option>
              </select>
            </div>
          </div>

          <div class="fdp-revenue-preview" id="fdp-sales-preview" style="margin-top:6px;">
            <span>Est. Room-Nights: <strong id="fdp-est-nights">0</strong></span>
            <span>Est. Revenue: <strong id="fdp-est-rev">$0</strong></span>
          </div>
        </div>

        <!-- COMPLAINT FIELDS -->
        <div id="fdp-complaint-fields" style="display:none;">
          <div class="fdp-field">
            <label class="fdp-label">Guest Name *</label>
            <input class="fdp-input" id="fdp-comp-name" placeholder="Guest Full Name" />
          </div>

          <div class="fdp-row" style="margin-top:6px;">
            <div class="fdp-field">
              <label class="fdp-label">Phone *</label>
              <input class="fdp-input" id="fdp-comp-phone" placeholder="(555) 000-0000" />
            </div>
            <div class="fdp-field">
              <label class="fdp-label">Room Number</label>
              <input class="fdp-input" id="fdp-comp-room" placeholder="e.g. 304" />
            </div>
          </div>

          <div class="fdp-field" style="margin-top:6px;">
            <label class="fdp-label">Reservation #</label>
            <input class="fdp-input" id="fdp-comp-res" placeholder="e.g. RES-98214" />
          </div>
        </div>

        <!-- MISC FIELDS -->
        <div id="fdp-misc-fields" style="display:none;">
          <div class="fdp-field">
            <label class="fdp-label">Topic / Subject *</label>
            <input class="fdp-input" id="fdp-misc-topic" placeholder="e.g. Safe key handoff, Maintenance" />
          </div>
        </div>

        <!-- SHARED CLERK NOTES -->
        <div class="fdp-field" style="margin-top:6px;">
          <label class="fdp-label">Clerk Notes / Details</label>
          <textarea class="fdp-textarea" id="fdp-notes" rows="2" placeholder="Add specific notes or context..."></textarea>
        </div>

        <!-- REMINDER TOGGLE -->
        <div style="display:flex; align-items:center; gap:6px; margin-top:2px;">
          <input type="checkbox" id="fdp-has-reminder" style="cursor:pointer;" />
          <label for="fdp-has-reminder" class="fdp-label" style="cursor:pointer; margin:0;">Set follow-up reminder for next shift</label>
        </div>

        <button type="submit" class="fdp-submit-btn" id="fdp-submit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>Save to Shift Log</span>
        </button>

        <div id="fdp-success" style="display:none;" class="fdp-success-banner">
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

  // Toggle open/close
  trigger.addEventListener('click', () => {
    modal.style.display = modal.style.display === 'none' ? 'flex' : 'none';
  });

  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
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

      // Update required attributes
      const salesName = document.getElementById('fdp-sales-name');
      const salesPhone = document.getElementById('fdp-sales-phone');
      const salesEmail = document.getElementById('fdp-sales-email');
      const compName = document.getElementById('fdp-comp-name');
      const compPhone = document.getElementById('fdp-comp-phone');
      const miscTopic = document.getElementById('fdp-misc-topic');

      if (activeCat === 'Sales') {
        salesName.required = true;
        salesPhone.required = true;
        salesEmail.required = true;
        compName.required = false;
        compPhone.required = false;
        miscTopic.required = false;
      } else if (activeCat === 'Complaint') {
        salesName.required = false;
        salesPhone.required = false;
        salesEmail.required = false;
        compName.required = true;
        compPhone.required = true;
        miscTopic.required = false;
      } else {
        salesName.required = false;
        salesPhone.required = false;
        salesEmail.required = false;
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
    const estRev = totalNights * 120; // Default factor $120/night

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
    const id = `log_${Date.now()}`;
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
        checkInDate: checkIn,
        checkOutDate: checkOut,
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

    // 1. Broadcast via P2P BroadcastChannel so open FrontDesk Pro tabs instantly update
    if (p2pChannel) {
      p2pChannel.postMessage({
        type: 'SHIFT_LOG_UPSERT',
        payload: entry,
      });
    }

    // 2. Also send window postMessage
    window.postMessage({ type: 'FDP_NEW_SHIFT_LOG', entry }, '*');

    // 3. Save to chrome.storage.local
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['frontdesk_logs'], (res) => {
        const existing = (res && res.frontdesk_logs) || [];
        existing.unshift(entry);
        chrome.storage.local.set({ frontdesk_logs: existing.slice(0, 50) });
      });
    }

    // Also save in localStorage if accessible
    try {
      const existingRaw = localStorage.getItem('frontdesk_external_logs');
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      existing.unshift(entry);
      localStorage.setItem('frontdesk_external_logs', JSON.stringify(existing.slice(0, 50)));
    } catch (e) {}

    // Show success
    const successBanner = document.getElementById('fdp-success');
    successBanner.style.display = 'block';

    setTimeout(() => {
      form.reset();
      updateRevenue();
      successBanner.style.display = 'none';
      modal.style.display = 'none';
    }, 1200);
  });
})();
