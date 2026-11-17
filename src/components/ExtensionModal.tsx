import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Puzzle,
  CheckCircle2,
  Laptop,
  Layers,
  Sparkles,
  Globe,
  Code,
  Upload,
  Play,
  Copy,
  Check,
  FileCode,
} from 'lucide-react';

interface ExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  isFloatingBubbleEnabled: boolean;
  onToggleFloatingBubble: () => void;
}

const BWH_FRONTDESK_WEB_SCRIPT = `// BWH Frontdesk Web -> FrontDesk Pro Reservation Integrator
// Target: https://americas.bwh.hkclients.com/frontdesk-web/*
(function (root) {
  'use strict';

  var HOST_SELECTOR = 'div[data-v-75e89ec1]';
  var MARK = 'data-fdp-injected';
  var MSG_TYPE = 'FRONTDESK_AUTOFILL_LOG';
  var FDP_ORIGIN = '*';

  function clean(s) {
    return (s || '').replace(/\\s+/g, ' ').trim();
  }

  function parseReservationText(text) {
    var t = text || '';
    var out = { guestName: '', phone: '', email: '', room: '', reservation: '' };
    var m;
    if ((m = t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/i))) out.email = m[0];
    if ((m = t.match(/(?:\\+?1[\\s.-]?)?\\(?[2-9]\\d{2}\\)?[\\s.-]?\\d{3}[\\s.-]?\\d{4}/))) out.phone = m[0].trim();
    if ((m = t.match(/\\b(?:Room|Rm)\\s*(?:#|No\\.?|Number)?\\s*:?\\s*([A-Z0-9-]{2,6})\\b/i))) out.room = m[1];
    if ((m = t.match(/\\b(?:Reservation|Res|Folio|Confirmation|Conf)\\s*(?:#|No\\.?|Number)?\\s*:?\\s*([A-Z0-9-]{4,})\\b/i))) out.reservation = m[1];
    if ((m = t.match(/\\bGuest(?:\\s*Name)?\\s*:?\\s*([^\\n|]+)/i))) out.guestName = clean(m[1]);
    return out;
  }

  function buildMessage(logType, data) {
    var category = logType === 'complaint' ? 'Complaint' : 'Miscellaneous';
    var payloadData = {
      category: category,
      name: data.guestName || data.name || '',
      guestName: data.guestName || data.name || '',
      phone: data.phone || data.phoneNumber || '',
      phoneNumber: data.phone || data.phoneNumber || '',
      email: data.email || '',
      room: data.room || data.roomNumber || '',
      roomNumber: data.room || data.roomNumber || '',
      reservation: data.reservation || data.reservationNumber || '',
      reservationNumber: data.reservation || data.reservationNumber || '',
      source: 'BWH Frontdesk Web',
      clerkNotes: 'Auto-captured from BWH Frontdesk Web (' + category + '). Res: ' + (data.reservation || 'N/A')
    };

    return {
      type: MSG_TYPE,
      source: 'bwh-frontdesk-web',
      logType: logType,
      category: category,
      data: payloadData,
      payload: payloadData
    };
  }

  function textOf(el) {
    return el ? clean(el.textContent) : '';
  }

  function scrapeActiveReservation(doc) {
    doc = doc || root.document;
    var host = doc.querySelector(HOST_SELECTOR);
    var card = host && (host.closest('.card, [class*="reservation"], [class*="Reservation"]') || host.parentElement);
    var scope = card || doc.body;
    var data = parseReservationText(scope.innerText || scope.textContent || '');

    if (host) {
      var headerClone = host.cloneNode(true);
      headerClone.querySelectorAll('button, .frontdesk-pro-actions, [' + MARK + ']').forEach(function(el) {
        el.remove();
      });
      var headerText = clean(headerClone.textContent);
      var cleanName = headerText.replace(/\\b(?:Edit|Refresh)\\b/gi, '').trim().split('\\n')[0].trim();
      if (cleanName && cleanName.length > 1 && cleanName.length < 50) {
        data.guestName = cleanName;
      }
    }

    if (!data.guestName) {
      var h = scope.querySelector('h1, h2, h3, [class*="guest-name"], [class*="guestName"], [class*="name"]');
      if (h) data.guestName = textOf(h);
    }
    var mail = scope.querySelector('a[href^="mailto:"]');
    if (mail) data.email = mail.getAttribute('href').replace(/^mailto:/i, '').split('?')[0];
    var tel = scope.querySelector('a[href^="tel:"]');
    if (tel) data.phone = decodeURIComponent(tel.getAttribute('href').replace(/^tel:/i, ''));
    return data;
  }

  function makeButton(doc, label, logType, ref) {
    var b = doc.createElement('button');
    b.type = 'button';
    b.setAttribute(MARK, logType);
    b.textContent = label;
    b.setAttribute('aria-label', label);
    var cs = ref && root.getComputedStyle ? root.getComputedStyle(ref) : null;
    var height = (cs && parseFloat(cs.height) > 0 && cs.height) || '32px';
    var radius = (cs && cs.borderRadius) || '4px';

    b.style.cssText = [
      'padding: 0 12px',
      'border-radius: ' + radius,
      'border: 1px solid #cfd4d9',
      'background: #ffffff',
      'color: #2f3e4e',
      'font-family: inherit',
      'font-size: 13px',
      'font-weight: 600',
      'cursor: pointer',
      'white-space: nowrap',
      'height: ' + height,
      'display: inline-flex',
      'align-items: center',
      'justify-content: center',
      'box-sizing: border-box',
      'transition: background 0.15s, border-color 0.15s, color 0.15s'
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
      var msg = buildMessage(logType, scrapeActiveReservation(doc));
      console.log('[FrontDesk Pro] Injected Button Clicked -> Sending:', msg);
      var target = root.opener || root.parent;
      try {
        if (target && target !== root) target.postMessage(msg, FDP_ORIGIN);
      } catch (err) {}
      try {
        root.postMessage(msg, '*');
      } catch (err) {}
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          chrome.runtime.sendMessage(msg, function() {});
        } catch (e) {}
      }
    });
    return b;
  }

  function inject(doc) {
    doc = doc || root.document;
    var hosts = doc.querySelectorAll(HOST_SELECTOR);
    var count = 0;
    hosts.forEach(function (host) {
      if (host.querySelector('[' + MARK + ']')) return;
      var actions = host.querySelectorAll('button, a[role="button"], .btn');
      if (!actions.length) return;
      var anchor = actions.length >= 2 ? actions[actions.length - 2] : actions[0];
      var parent = anchor.parentNode;
      var wrap = doc.createElement('span');
      wrap.setAttribute(MARK, 'wrap');
      wrap.setAttribute('data-bwh-logs', '');
      wrap.setAttribute('data-v-75e89ec1', '');
      wrap.style.cssText = 'display:inline-flex;gap:8px;margin-right:8px;align-items:center;vertical-align:middle;';
      wrap.appendChild(makeButton(doc, '+ Complaint Log', 'complaint', anchor));
      wrap.appendChild(makeButton(doc, '+ Misc Log', 'misc', anchor));
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

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseReservationText, buildMessage, scrapeActiveReservation, inject, start };
  } else if (root.document) {
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);`;

const SAMPLE_PMS_SCRIPT = `// FrontDesk Pro — Generic PMS Reservation DOM Scraper
(function() {
  const guestName = document.querySelector('[data-field="guest-name"], .guest-name, #guestName')?.textContent?.trim() || '';
  const phoneNumber = document.querySelector('[data-field="phone"], .phone-number, #phone')?.textContent?.trim() || '';
  const roomNumber = document.querySelector('[data-field="room"], .room-number, #room')?.textContent?.trim() || '';
  const reservationNumber = document.querySelector('[data-field="confirmation"], .confirmation-number, #confirmation')?.textContent?.trim() || '';

  window.postMessage({
    type: 'FRONTDESK_AUTOFILL_LOG',
    data: {
      category: 'Complaint',
      name: guestName,
      phoneNumber: phoneNumber,
      roomNumber: roomNumber,
      reservationNumber: reservationNumber,
      clerkNotes: \`Autofilled from \${window.location.hostname} (Res #\${reservationNumber || 'N/A'})\`
    }
  }, '*');
})();`;

export const ExtensionModal: React.FC<ExtensionModalProps> = ({
  isOpen,
  onClose,
  isFloatingBubbleEnabled,
  onToggleFloatingBubble,
}) => {
  const [activeTab, setActiveTab] = useState<'extension' | 'scriptRunner'>('extension');
  const [scriptCode, setScriptCode] = useState(BWH_FRONTDESK_WEB_SCRIPT);
  const [scriptFileName, setScriptFileName] = useState('bwh-reservation-injector.js');
  const [isAutoRun, setIsAutoRun] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('fdp_script_runner_code');
      if (stored) setScriptCode(stored);
      const storedName = localStorage.getItem('fdp_script_runner_filename');
      if (storedName) setScriptFileName(storedName);
      const storedAuto = localStorage.getItem('fdp_script_runner_autorun');
      if (storedAuto) setIsAutoRun(storedAuto === 'true');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScriptFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        setScriptCode(content);
        localStorage.setItem('fdp_script_runner_code', content);
        localStorage.setItem('fdp_script_runner_filename', file.name);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    };
    reader.readAsText(file);
  };

  const handleSaveScript = () => {
    localStorage.setItem('fdp_script_runner_code', scriptCode);
    localStorage.setItem('fdp_script_runner_filename', scriptFileName);
    localStorage.setItem('fdp_script_runner_autorun', String(isAutoRun));

    // Broadcast update to content scripts and extension
    window.postMessage({
      type: 'FDP_CUSTOM_SCRIPT_SAVED',
      script: scriptCode,
      fileName: scriptFileName,
      autoRun: isAutoRun,
    }, '*');

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleExecuteScriptNow = () => {
    try {
      // Execute the script in page context
      const scriptEl = document.createElement('script');
      scriptEl.textContent = scriptCode;
      document.body.appendChild(scriptEl);
      scriptEl.remove();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to run custom script:', err);
      alert('Script execution error. Check browser console.');
    }
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-gray-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-600 rounded-xl">
              <Puzzle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                <span>FrontDesk Pro — Browser Extension & Automation</span>
              </h3>
              <p className="text-xs text-gray-400">Floating Shift Log, Lead Capture & DOM Script Runner</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-200 bg-gray-50/80 px-6 pt-2 gap-3 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('extension')}
            className={`pb-2.5 border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'extension'
                ? 'border-blue-600 text-blue-600 font-extrabold'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Puzzle className="w-3.5 h-3.5" />
            <span>1. Chrome Extension Pack</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('scriptRunner')}
            className={`pb-2.5 border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'scriptRunner'
                ? 'border-blue-600 text-blue-600 font-extrabold'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>2. ⚡ Script Runner & DOM Autofill</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-gray-700">
          {activeTab === 'extension' && (
            <>
              {/* Benefit Card */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex items-start space-x-3.5">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg flex-shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="text-xs leading-relaxed">
                  <strong className="text-blue-950 font-bold block mb-1">
                    Log Leads & Complaints From Any Browser Tab
                  </strong>
                  Clerks can capture group sales leads, guest complaints, and handover notes from any active tab (PMS software, Gmail, Booking.com, Expedia) using a floating bubble without interrupting their workflow.
                </div>
              </div>

              {/* Live In-App Test Toggle */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-xs">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-xs font-bold text-gray-900 block">
                      Interactive Floating Bubble
                    </strong>
                    <span className="text-[11px] text-gray-500">
                      {isFloatingBubbleEnabled
                        ? 'Active in the bottom-right corner of this page'
                        : 'Show floating bubble preview directly on this tab'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onToggleFloatingBubble}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer ${
                    isFloatingBubbleEnabled
                      ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isFloatingBubbleEnabled ? 'Disable Preview' : 'Enable Preview'}
                </button>
              </div>

              {/* Download & Install Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Install Chrome / Edge / Brave Extension
                  </h4>
                  <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <Globe className="w-3 h-3 text-emerald-600" />
                    <span>Production Pack</span>
                  </span>
                </div>

                {/* Target Domain Callout */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-slate-600 font-medium">Default App Domain:</span>
                    <code className="text-[11px] font-mono font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      https://cashdrawermanagement.netlify.app/app
                    </code>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                    (Editable via Extension Popup)
                  </span>
                </div>

                {/* Download Button */}
                <a
                  href="/frontdesk-pro-extension.zip"
                  download="frontdesk-pro-extension.zip"
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl shadow-sm hover:shadow transition flex items-center justify-center space-x-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Extension Package (.zip)</span>
                </a>

                {/* 3 Step Installation Guide */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 text-xs">
                  <div className="flex items-start space-x-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                      1
                    </span>
                    <div>
                      <strong className="text-gray-900 block font-semibold">Unzip the package</strong>
                      <span className="text-gray-500">Extract the downloaded <code className="bg-gray-200 px-1 py-0.5 rounded text-[10px]">frontdesk-pro-extension.zip</code> file on your computer.</span>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                      2
                    </span>
                    <div>
                      <strong className="text-gray-900 block font-semibold">Open Chrome Extensions</strong>
                      <span className="text-gray-500">Go to <code className="bg-gray-200 px-1 py-0.5 rounded text-[10px]">chrome://extensions</code> and toggle on <strong className="text-gray-800">Developer mode</strong> in the top-right corner.</span>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                      3
                    </span>
                    <div>
                      <strong className="text-gray-900 block font-semibold">Load unpacked</strong>
                      <span className="text-gray-500">Click <strong className="text-gray-800">Load unpacked</strong> and select the extracted folder (which contains <code className="bg-gray-200 px-1 py-0.5 rounded text-[10px]">manifest.json</code>). The floating bubble will appear on all browser tabs!</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Features Checkpoints */}
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                <div className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Manifest V3 compatible</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Real-time P2P sync</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Automatic staff login detection</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>DOM Reservation Script Runner</span>
                </div>
              </div>
            </>
          )}

          {activeTab === 'scriptRunner' && (
            <div className="space-y-4">
              {/* Explanation Card */}
              <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 flex items-start space-x-3.5">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-lg flex-shrink-0 mt-0.5">
                  <Code className="w-4 h-4" />
                </div>
                <div className="text-xs leading-relaxed">
                  <strong className="text-purple-950 font-bold block mb-1">
                    Direct PMS & Reservation DOM Autofill
                  </strong>
                  Upload and execute custom JavaScript to manipulate PMS reservation pages (Cloudbeds, Opera, WebRezPro, Booking.com, Expedia) and directly autofill guest name, phone, room number, reservation #, and complaint/log details without manual data entry.
                </div>
              </div>

              {/* Upload & Script Status Bar */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <FileCode className="w-4 h-4 text-blue-600" />
                  <div>
                    <span className="text-xs font-bold text-gray-900 block">{scriptFileName}</span>
                    <span className="text-[10px] text-gray-500">
                      {scriptCode.length} characters • Ready to inject
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-2xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Script (.js)</span>
                    <input
                      type="file"
                      accept=".js,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleExecuteScriptNow}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-2xs cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Run Script Now</span>
                  </button>
                </div>
              </div>

              {savedSuccess && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center space-x-2 font-semibold animate-in fade-in">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>Script saved and synced with FrontDesk Pro Extension!</span>
                </div>
              )}

              {/* Code Editor */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                    <span>DOM Script Code</span>
                    <span className="text-[10px] text-gray-400 font-normal lowercase">(auto-executes window.postMessage FRONTDESK_AUTOFILL_LOG)</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setScriptCode(BWH_FRONTDESK_WEB_SCRIPT);
                        setScriptFileName('bwh-reservation-injector.js');
                      }}
                      className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[11px] font-bold cursor-pointer transition"
                    >
                      🏨 BWH Frontdesk Web
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setScriptCode(SAMPLE_PMS_SCRIPT);
                        setScriptFileName('pms-reservation-autofill.js');
                      }}
                      className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 rounded text-[11px] font-bold cursor-pointer transition"
                    >
                      🌐 Generic PMS
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyScript}
                      className="text-[11px] text-blue-600 hover:underline flex items-center space-x-1 font-semibold cursor-pointer pl-1"
                    >
                      {copiedScript ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedScript ? 'Copied' : 'Copy Code'}</span>
                    </button>
                  </div>
                </div>
                <textarea
                  rows={8}
                  value={scriptCode}
                  onChange={(e) => setScriptCode(e.target.value)}
                  className="w-full p-3 font-mono text-[11px] bg-slate-900 text-slate-100 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                />
              </div>

              {/* Auto-run Toggle & Save */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-gray-200">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAutoRun}
                    onChange={(e) => setIsAutoRun(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs text-gray-700 font-semibold select-none">
                    Auto-execute script on reservation & PMS tabs
                  </span>
                </label>

                <button
                  type="button"
                  onClick={handleSaveScript}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save & Sync Script to Extension</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-3.5 border-t border-gray-200 flex items-center justify-between text-xs">
          <span className="text-gray-500 flex items-center space-x-1">
            <Laptop className="w-3.5 h-3.5" />
            <span>Works in Chrome, Edge, Brave & Opera</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};