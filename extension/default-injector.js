// BWH Frontdesk Web -> FrontDesk Pro Reservation Integrator (Production v2.4)
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

  function getLoggedInClerkName(doc) {
    var staffEls = doc.querySelectorAll('header .user-name, header [class*="user"], nav [class*="user"], .hk-user-dropdown, .profile-name, [class*="profile"]');
    for (var i = 0; i < staffEls.length; i++) {
      var txt = clean(staffEls[i].textContent);
      if (txt && txt.length > 2 && txt.length < 40 && !/help|folio|guest|stay/i.test(txt)) {
        return txt;
      }
    }
    return '';
  }

  function scrapeActiveReservation(doc) {
    doc = doc || root.document;
    var data = { guestName: '', phone: '', email: '', room: '', reservation: '' };
    var loggedClerk = getLoggedInClerkName(doc);

    // 1. Primary & Authoritative: Page Title Header (e.g. "14241009477 / JAMES CALVIN ANDERSON / Room - 405 (IN HOUSE)")
    var titleHeadings = doc.querySelectorAll('div.date-title h4, h4[data-v-796e4b3f], h4, h3, h2');
    for (var i = 0; i < titleHeadings.length; i++) {
      var headingText = clean(titleHeadings[i].textContent);
      if (headingText.includes('/') && /Room/i.test(headingText)) {
        var parsed = parseTitle(headingText);
        if (parsed.reservation) data.reservation = parsed.reservation;
        if (parsed.guestName && parsed.guestName !== loggedClerk) data.guestName = parsed.guestName;
        if (parsed.room) data.room = parsed.room;
        if (data.guestName) break;
      }
    }

    // 2. Card Reservation Data (scoped strictly to Guest Tab card, never navbar user menu)
    var guestCards = doc.querySelectorAll('div[data-v-75e89ec1].card, div.card');
    var card = null;
    for (var c = 0; c < guestCards.length; c++) {
      var cText = guestCards[c].textContent || '';
      if (/Guarantee Type|Rate Plan|Additional Guests|Remarks/i.test(cText)) {
        card = guestCards[c];
        break;
      }
    }
    if (!card && guestCards.length > 0) card = guestCards[0];

    if (card) {
      if (!data.guestName || data.guestName === loggedClerk) {
        var cardHeadings = card.querySelectorAll('h1, h2, h3, h4, h5, div.fw-600, div[class*="guest"]');
        for (var h = 0; h < cardHeadings.length; h++) {
          var hTxt = clean(cardHeadings[h].textContent);
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
          var firstInp = card.querySelector('input[placeholder*="First" i], input[name*="first" i]');
          var lastInp = card.querySelector('input[placeholder*="Last" i], input[name*="last" i]');
          if (firstInp && lastInp && clean(firstInp.value) && clean(lastInp.value)) {
            data.guestName = clean(firstInp.value + ' ' + lastInp.value);
          }
        }
      }

      var phoneEl = card.querySelector('.phone span, [class*="phone"] span, [class*="phone"]');
      if (phoneEl && clean(phoneEl.textContent)) {
        var pMatch = clean(phoneEl.textContent).match(/(?:\+?1[\s.-]?)?\(?[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
        if (pMatch) data.phone = pMatch[0];
      }

      var emailEl = card.querySelector('.hk-tooltip-wrapper span, [class*="email"] span, [class*="email"]');
      if (emailEl && clean(emailEl.textContent)) {
        var eMatch = clean(emailEl.textContent).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
        if (eMatch) data.email = eMatch[0];
      }
    }

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
    var defaultTopic = logType === 'complaint'
      ? ('Guest Complaint: ' + (data.guestName || 'Room ' + (data.room || 'N/A')))
      : ('Shift Note: ' + (data.guestName || 'Room ' + (data.room || 'N/A')));

    var d = {
      category: category,
      topic: defaultTopic,
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

  function makeButton(doc, label, logType, targetHeight, targetRadius) {
    var b = doc.createElement('button');
    b.type = 'button';
    b.setAttribute(MARK, logType);
    b.textContent = label;
    b.setAttribute('aria-label', label);

    var h = targetHeight ? (targetHeight + 'px') : '32px';
    var r = targetRadius || '4px';

    b.style.cssText = [
      'height: ' + h + ' !important',
      'min-height: ' + h + ' !important',
      'max-height: ' + h + ' !important',
      'padding: 0 10px !important',
      'border-radius: ' + r + ' !important',
      'border: 1px solid #cfd4d9 !important',
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

      try {
        root.postMessage(msg, '*');
      } catch (err) {}

      var target = root.opener || root.parent;
      try {
        if (target && target !== root) target.postMessage(msg, '*');
      } catch (err) {}

      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          chrome.runtime.sendMessage(msg, function () {});
        } catch (e) {}
      }

      showToast('✓ ' + (logType === 'complaint' ? 'Complaint' : 'Misc') + ' Log triggered for ' + (scraped.guestName || 'Guest') + ' (Room ' + (scraped.room || 'N/A') + ')', logType === 'complaint' ? '#e11d48' : '#4f46e5');
    });

    return b;
  }

  function findActionGroup(doc) {
    doc = doc || root.document;

    // 1. Look for pencil icon / pen_icon in the guest profile card
    var editIcons = doc.querySelectorAll('[data-train-key-id="pen_icon"], [aria-label*="Edit Guest"], .edit-icon');
    for (var i = 0; i < editIcons.length; i++) {
      var icon = editIcons[i];
      var parent = (icon.closest ? icon.closest('.flexed') : null) || icon.parentElement;
      if (!parent) continue;

      var pText = (parent.parentElement ? parent.parentElement.textContent : '') + ' ' + (parent.textContent || '');
      if (/Guarantee|Rate Plan|Credit Card|Payment|Source|Local|RACK/i.test(pText)) {
        continue;
      }

      return parent;
    }

    // 2. Direct card header actions container
    var headerRow = doc.querySelector('div[data-v-75e89ec1].card > div:first-child .flexed, div.card > div:first-child .flexed');
    if (headerRow) return headerRow;

    return null;
  }

  function inject(doc) {
    doc = doc || root.document;

    var existingWraps = doc.querySelectorAll('span[' + MARK + '="wrap"]');
    if (existingWraps.length > 1) {
      for (var w = 1; w < existingWraps.length; w++) {
        existingWraps[w].remove();
      }
    }

    var group = findActionGroup(doc);
    if (!group) return 0;

    if (group.querySelector('span[' + MARK + '="wrap"]')) {
      return 1;
    }

    if (existingWraps.length > 0) {
      existingWraps[0].remove();
    }

    var anchor = group.querySelector('.edit-icon:first-child, [data-train-key-id="guest_dashboard"]') || group.firstElementChild;
    if (!anchor) return 0;

    var computed = root.getComputedStyle ? root.getComputedStyle(anchor) : null;
    var rect = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null;
    var targetHeight = (rect && rect.height > 18)
      ? Math.round(rect.height)
      : ((anchor.offsetHeight && anchor.offsetHeight > 18)
        ? anchor.offsetHeight
        : (computed && parseFloat(computed.height) > 18 ? Math.round(parseFloat(computed.height)) : 30));
    var targetRadius = (computed && computed.borderRadius) || '4px';

    var wrap = doc.createElement('span');
    wrap.setAttribute(MARK, 'wrap');
    wrap.setAttribute('data-bwh-logs', '');
    wrap.style.cssText = 'display:inline-flex;align-items:center;vertical-align:middle;margin-right:6px;';

    wrap.appendChild(makeButton(doc, '+ Complaint Log', 'complaint', targetHeight, targetRadius));
    wrap.appendChild(makeButton(doc, '+ Misc Log', 'misc', targetHeight, targetRadius));

    group.insertBefore(wrap, anchor);
    return 1;
  }

  function start() {
    inject();
    if (root.document && root.document.body) {
      new MutationObserver(function () { inject(); }).observe(root.document.body, { childList: true, subtree: true });
    }
    setInterval(function () { inject(); }, 1200);
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
