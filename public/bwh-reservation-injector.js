// BWH Frontdesk Web -> FrontDesk Pro Reservation Integrator (Production v2.2)
// Target: https://americas.bwh.hkclients.com/frontdesk-web/*
(function (root) {
  'use strict';

  var MARK = 'data-fdp-injected';
  var MSG_TYPE = 'FRONTDESK_AUTOFILL_LOG';

  function clean(s) {
    return (s || '').replace(/\s+/g, ' ').trim();
  }

  function parseReservationText(text) {
    var t = text || '';
    var out = { guestName: '', phone: '', email: '', room: '', reservation: '' };
    var m;
    if ((m = t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i))) out.email = m[0];
    if ((m = t.match(/(?:\+?1[\s.-]?)?\(?[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4}/))) out.phone = m[0].trim();
    if ((m = t.match(/\b(?:Room|Rm)\s*(?:#|No\.?|Number)?\s*[-:]?\s*([A-Z0-9-]{2,6})\b/i))) out.room = m[1];
    if ((m = t.match(/\b(?:Reservation|Res|Folio|Confirmation)\s*(?:#|No\.?|Number)?\s*[-:]?\s*([A-Z0-9-]{4,})/i))) out.reservation = m[1];
    return out;
  }

  function parseTitle(s) {
    var parts = (s || '').split('/').map(clean);
    var resNumber = parts[0] || '';
    var guest = parts[1] || '';
    var room = '';
    if (parts[2]) {
      var rmMatch = parts[2].match(/\b(?:Room\s*[-#:]?\s*)?([0-9]{2,5}[A-Za-z]?)\b/i);
      room = rmMatch ? rmMatch[1] : parts[2].replace(/^Room\s*[-#:]?\s*/i, '').split(' ')[0];
    }
    return { reservation: resNumber, guestName: guest, room: room };
  }

  function scrapeActiveReservation(doc) {
    doc = doc || root.document;
    var card = doc.querySelector('div[data-v-75e89ec1].card') || doc.querySelector('div[data-v-75e89ec1]');
    var data = { guestName: '', phone: '', email: '', room: '', reservation: '' };

    // 1. Primary: Page Title Header (e.g. "14241009477 / JAMES CALVIN ANDERSON / Room - 405 (IN HOUSE)")
    var titleEl = doc.querySelector('div.date-title h4, h4[data-v-796e4b3f]');
    if (titleEl) {
      var parsed = parseTitle(clean(titleEl.textContent));
      if (parsed.reservation) data.reservation = parsed.reservation;
      if (parsed.guestName) data.guestName = parsed.guestName;
      if (parsed.room) data.room = parsed.room;
    }

    // 2. Card Reservation Data (scoped strictly to card, never navbar user)
    if (card) {
      var cardName = card.querySelector('span.user-name, div.fw-600 span.user-name');
      if (cardName && clean(cardName.textContent)) {
        data.guestName = clean(cardName.textContent);
      }

      var phoneEl = card.querySelector('.phone span, [class*="phone"] span');
      if (phoneEl && clean(phoneEl.textContent)) data.phone = clean(phoneEl.textContent);

      var emailEl = card.querySelector('.hk-tooltip-wrapper span, [class*="email"] span');
      if (emailEl && clean(emailEl.textContent)) data.email = clean(emailEl.textContent);
    }

    // 3. Fallback regex on card text only
    if (!data.phone || !data.email) {
      var scopeText = (card || doc.body).innerText || (card || doc.body).textContent || '';
      var fallback = parseReservationText(scopeText);
      if (!data.phone && fallback.phone) data.phone = fallback.phone;
      if (!data.email && fallback.email) data.email = fallback.email;
    }

    return data;
  }

  function buildMessage(logType, data) {
    var category = logType === 'complaint' ? 'Complaint' : 'Miscellaneous';
    var d = {
      category: category,
      name: data.guestName || '',
      guestName: data.guestName || '',
      phone: data.phone || '',
      phoneNumber: data.phone || '',
      email: data.email || '',
      room: data.room || '',
      roomNumber: data.room || '',
      reservation: data.reservation || '',
      reservationNumber: data.reservation || '',
      url: root.location ? root.location.href : '',
      ts: new Date().toISOString(),
      clerkNotes: 'Auto-captured from BWH Frontdesk Web (' + category + '). Room ' + (data.room || 'N/A') + ' • Res #' + (data.reservation || 'N/A')
    };

    return {
      type: MSG_TYPE,
      source: 'bwh-frontdesk-web',
      category: category,
      logType: logType,
      data: d,
      payload: d
    };
  }

  function showToast(text, color) {
    if (!root.document || !root.document.body || !root.document.getElementById) return;
    var existing = root.document.getElementById('fdp-toast-alert');
    if (existing) existing.remove();

    var toast = root.document.createElement('div');
    toast.id = 'fdp-toast-alert';
    toast.textContent = text;
    toast.style.cssText = [
      'position: fixed',
      'bottom: 24px',
      'right: 24px',
      'z-index: 9999999',
      'background: ' + (color || '#1e293b'),
      'color: #ffffff',
      'padding: 10px 18px',
      'border-radius: 8px',
      'font-size: 13px',
      'font-weight: 600',
      'box-shadow: 0 4px 14px rgba(0,0,0,0.25)',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      'display: flex',
      'align-items: center',
      'gap: 8px',
      'animation: fdpFadeIn 0.25s ease-out'
    ].join(';');

    root.document.body.appendChild(toast);
    setTimeout(function() {
      toast.style.transition = 'opacity 0.3s';
      toast.style.opacity = '0';
      setTimeout(function() { toast.remove(); }, 300);
    }, 2800);
  }

  function makeButton(doc, label, logType) {
    var b = doc.createElement('button');
    b.type = 'button';
    b.setAttribute(MARK, logType);
    b.textContent = label;
    b.setAttribute('aria-label', label);

    b.style.cssText = [
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

    b.addEventListener('mouseenter', function () {
      b.style.background = logType === 'complaint' ? '#fff1f2' : '#f0f5ff';
      b.style.borderColor = logType === 'complaint' ? '#f43f5e' : '#6366f1';
      b.style.color = logType === 'complaint' ? '#e11d48' : '#4338ca';
    });

    b.addEventListener('mouseleave', function () {
      b.style.background = '#ffffff';
      b.style.borderColor = '#cfd4d9';
      b.style.color = '#2f3e4e';
    });

    b.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var scraped = scrapeActiveReservation(doc);
      var msg = buildMessage(logType, scraped);
      console.log('[FrontDesk Pro] Injected Button Clicked -> Sending:', msg);

      // 1. Post to window for extension content script and floating bubble
      try {
        root.postMessage(msg, '*');
      } catch (err) {}

      // 2. Post to opener or parent if opened from FrontDesk Pro tab
      var target = root.opener || root.parent;
      try {
        if (target && target !== root) target.postMessage(msg, '*');
      } catch (err) {}

      // 3. Post to Chrome extension background
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          chrome.runtime.sendMessage(msg, function () {});
        } catch (e) {}
      }

      showToast('✓ ' + (logType === 'complaint' ? 'Complaint' : 'Misc') + ' Log triggered for ' + (scraped.guestName || 'Guest') + ' (Room ' + (scraped.room || 'N/A') + ')', logType === 'complaint' ? '#e11d48' : '#4f46e5');
    });

    return b;
  }

  function findActionGroups(doc) {
    var groups = [];
    // Target ONLY the top-right action buttons row containing the Edit Guest icon
    var editIcon = doc.querySelector('[aria-label*="Edit Guest"], [data-train-key-id="pen_icon"], [aria-label*="Edit"]');
    if (editIcon) {
      var flexParent = (editIcon.closest ? editIcon.closest('.flexed') : null) || editIcon.parentElement;
      if (flexParent) {
        groups.push(flexParent);
        return groups;
      }
    }

    var headerGroup = doc.querySelector('div[data-v-75e89ec1].card > div.fw-600.flexed.justify-between > div.flexed.gap-5');
    if (headerGroup && headerGroup.querySelector('.edit-icon, [data-train-key-id="guest_dashboard"]')) {
      groups.push(headerGroup);
      return groups;
    }

    return groups;
  }

  function inject(doc) {
    doc = doc || root.document;

    // Clean up any stray buttons placed in Guarantee Type or other rows
    var allWraps = doc.querySelectorAll('span[' + MARK + '="wrap"]');
    allWraps.forEach(function(w) {
      if (!w.parentElement || !w.parentElement.querySelector('[aria-label*="Edit"], [data-train-key-id="pen_icon"], [data-train-key-id="guest_dashboard"]')) {
        w.remove();
      }
    });

    var groups = findActionGroups(doc);
    var count = 0;

    groups.forEach(function (parent) {
      if (parent.querySelector('[' + MARK + ']')) return;

      // Locate anchor: refresh donut icon (first child or element before edit icon)
      var anchor = parent.querySelector('.edit-icon:first-child, [data-train-key-id="guest_dashboard"]') || parent.firstElementChild;
      if (!anchor) return;

      var wrap = doc.createElement('span');
      wrap.setAttribute(MARK, 'wrap');
      wrap.setAttribute('data-bwh-logs', '');
      wrap.setAttribute('data-v-75e89ec1', '');
      wrap.style.cssText = 'display:inline-flex;align-items:center;vertical-align:middle;';

      wrap.appendChild(makeButton(doc, '+ Complaint Log', 'complaint'));
      wrap.appendChild(makeButton(doc, '+ Misc Log', 'misc'));

      parent.insertBefore(wrap, anchor);
      count++;
    });

    return count;
  }

  function start() {
    var pending = false;
    function schedule() {
      if (pending) return;
      pending = true;
      root.requestAnimationFrame(function () {
        pending = false;
        inject();
      });
    }

    if (root.document && root.document.body) {
      new MutationObserver(schedule).observe(root.document.body, { childList: true, subtree: true });
    }
    inject();
  }

  var api = {
    parseTitle: parseTitle,
    parseReservationText: parseReservationText,
    scrapeActiveReservation: scrapeActiveReservation,
    inject: inject,
    start: start
  };

  root.BwhInjector = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else if (root.document) {
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
