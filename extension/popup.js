// FrontDesk Pro — Extension Popup Script
const DEFAULT_APP_URL = 'https://cashdrawermanagement.netlify.app/app';

document.addEventListener('DOMContentLoaded', async () => {
  const staffNameEl = document.getElementById('staff-name');
  const openAppBtn = document.getElementById('open-app-btn');
  const currentUrlEl = document.getElementById('current-app-url');
  const editUrlBtn = document.getElementById('edit-url-btn');
  const urlViewContainer = document.getElementById('url-view-container');
  const urlEditContainer = document.getElementById('url-edit-container');
  const appUrlInput = document.getElementById('app-url-input');
  const saveUrlBtn = document.getElementById('save-url-btn');
  const resetUrlBtn = document.getElementById('reset-url-btn');
  const cancelUrlBtn = document.getElementById('cancel-url-btn');
  const saveBanner = document.getElementById('url-save-banner');

  let activeUrl = DEFAULT_APP_URL;

  // 1. Load stored app URL
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const res = await chrome.storage.local.get(['frontdesk_app_url', 'frontdesk_user']);
    if (res && res.frontdesk_app_url) {
      activeUrl = res.frontdesk_app_url;
    }
    currentUrlEl.textContent = activeUrl;
    appUrlInput.value = activeUrl;

    // Load active staff profile
    if (res && res.frontdesk_user && res.frontdesk_user.fullName) {
      staffNameEl.textContent = `${res.frontdesk_user.fullName} (${res.frontdesk_user.role})`;
      staffNameEl.style.color = '#0f172a';
    } else {
      staffNameEl.textContent = 'Not Signed In';
      staffNameEl.style.color = '#b45309';
    }
  } else {
    currentUrlEl.textContent = activeUrl;
    appUrlInput.value = activeUrl;
    staffNameEl.textContent = 'Not Signed In';
    staffNameEl.style.color = '#b45309';
  }

  // 2. Edit URL Toggle
  editUrlBtn.addEventListener('click', () => {
    urlViewContainer.style.display = 'none';
    urlEditContainer.style.display = 'block';
    editUrlBtn.style.display = 'none';
    appUrlInput.focus();
  });

  cancelUrlBtn.addEventListener('click', () => {
    appUrlInput.value = activeUrl;
    urlEditContainer.style.display = 'none';
    urlViewContainer.style.display = 'block';
    editUrlBtn.style.display = 'inline-block';
  });

  resetUrlBtn.addEventListener('click', async () => {
    appUrlInput.value = DEFAULT_APP_URL;
    activeUrl = DEFAULT_APP_URL;
    currentUrlEl.textContent = activeUrl;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ frontdesk_app_url: DEFAULT_APP_URL });
    }
    showSavedBanner();
    urlEditContainer.style.display = 'none';
    urlViewContainer.style.display = 'block';
    editUrlBtn.style.display = 'inline-block';
  });

  saveUrlBtn.addEventListener('click', async () => {
    let clean = appUrlInput.value.trim();
    if (!clean) clean = DEFAULT_APP_URL;
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'https://' + clean;
    }
    activeUrl = clean;
    currentUrlEl.textContent = activeUrl;

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ frontdesk_app_url: activeUrl });
    }

    showSavedBanner();
    urlEditContainer.style.display = 'none';
    urlViewContainer.style.display = 'block';
    editUrlBtn.style.display = 'inline-block';
  });

  function showSavedBanner() {
    saveBanner.style.display = 'block';
    setTimeout(() => {
      saveBanner.style.display = 'none';
    }, 2000);
  }

  // 3. Open App in tab
  openAppBtn.addEventListener('click', async () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      await chrome.tabs.create({ url: activeUrl });
    } else {
      window.open(activeUrl, '_blank');
    }
  });

  // =========================================================================
  // 4. DOM Script Runner & Reservation Autofill Handler
  // =========================================================================
  const uploadScriptBtn = document.getElementById('upload-script-btn');
  const resetScriptBtn = document.getElementById('reset-script-btn');
  const scriptUploadInput = document.getElementById('script-upload-input');
  const runScriptBtn = document.getElementById('run-script-btn');
  const scriptStatusBadge = document.getElementById('script-status-badge');
  const scriptInfo = document.getElementById('script-info');
  const scriptFilename = document.getElementById('script-filename');
  const autoRunCheckbox = document.getElementById('auto-run-script-checkbox');
  const scriptBanner = document.getElementById('script-banner');

  function showScriptBanner(msg) {
    if (!scriptBanner) return;
    scriptBanner.textContent = msg;
    scriptBanner.style.display = 'block';
    setTimeout(() => {
      scriptBanner.style.display = 'none';
    }, 2500);
  }

  // Load saved script info & autorun state
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['fdp_custom_script', 'fdp_custom_script_filename', 'fdp_script_autorun'], (res) => {
      if (res && res.fdp_custom_script) {
        scriptStatusBadge.textContent = 'Custom';
        scriptStatusBadge.style.background = '#dbeafe';
        scriptStatusBadge.style.color = '#1d4ed8';
        scriptInfo.style.display = 'block';
        scriptFilename.textContent = `Custom: ${res.fdp_custom_script_filename || 'uploaded-script.js'} (${res.fdp_custom_script.length} chars)`;
      } else {
        scriptStatusBadge.textContent = 'Default (BWH)';
        scriptStatusBadge.style.background = '#ecfdf5';
        scriptStatusBadge.style.color = '#047857';
        scriptInfo.style.display = 'block';
        scriptFilename.textContent = 'Active: bwh-reservation-injector.js (Built-in Default)';
      }

      if (res && res.fdp_script_autorun === false) {
        autoRunCheckbox.checked = false;
      } else {
        autoRunCheckbox.checked = true; // Auto-run enabled by default
      }
    });
  }

  // Trigger file upload
  uploadScriptBtn.addEventListener('click', () => {
    scriptUploadInput.click();
  });

  // Handle file selected
  scriptUploadInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const code = evt.target && evt.target.result;
      if (typeof code === 'string') {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          await chrome.storage.local.set({
            fdp_custom_script: code,
            fdp_custom_script_filename: file.name,
          });
        }
        scriptStatusBadge.textContent = 'Custom';
        scriptStatusBadge.style.background = '#dbeafe';
        scriptStatusBadge.style.color = '#1d4ed8';
        scriptInfo.style.display = 'block';
        scriptFilename.textContent = `Custom: ${file.name} (${code.length} chars)`;
        showScriptBanner(`Loaded ${file.name} as active driver!`);
      }
    };
    reader.readAsText(file);
  });

  // Reset to default built-in script
  if (resetScriptBtn) {
    resetScriptBtn.addEventListener('click', async () => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.remove(['fdp_custom_script', 'fdp_custom_script_filename']);
      }
      scriptStatusBadge.textContent = 'Default (BWH)';
      scriptStatusBadge.style.background = '#ecfdf5';
      scriptStatusBadge.style.color = '#047857';
      scriptInfo.style.display = 'block';
      scriptFilename.textContent = 'Active: bwh-reservation-injector.js (Built-in Default)';
      showScriptBanner('Reset to default BWH injection script!');
    });
  }

  // Handle autorun checkbox
  autoRunCheckbox.addEventListener('change', async () => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ fdp_script_autorun: autoRunCheckbox.checked });
      showScriptBanner(autoRunCheckbox.checked ? 'Auto-run enabled on reservation tabs' : 'Auto-run disabled');
    }
  });

  // Handle run script on active tab
  runScriptBtn.addEventListener('click', async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;

    chrome.storage.local.get(['fdp_custom_script'], async (res) => {
      let scriptCode = res && res.fdp_custom_script;
      if (!scriptCode) {
        try {
          const resp = await fetch(chrome.runtime.getURL('default-injector.js'));
          scriptCode = await resp.text();
        } catch (err) {
          console.error('Failed to load default injector:', err);
        }
      }

      if (!scriptCode) {
        showScriptBanner('No script available to execute');
        return;
      }

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) return;

      chrome.tabs.sendMessage(tab.id, { type: 'EXECUTE_CUSTOM_SCRIPT', script: scriptCode }, (response) => {
        if (chrome.runtime.lastError) {
          // If content script was not already listening, execute directly
          if (chrome.scripting && chrome.scripting.executeScript) {
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (code) => {
                try {
                  const s = document.createElement('script');
                  s.textContent = code;
                  (document.head || document.documentElement).appendChild(s);
                  s.remove();
                } catch(err) {
                  console.error('FrontDesk Pro Script Error:', err);
                }
              },
              args: [scriptCode],
            });
            showScriptBanner('Script executed on page!');
          } else {
            showScriptBanner('Page not ready for script execution');
          }
        } else {
          showScriptBanner('Script executed & DOM scanned!');
        }
      });
    });
  });
});
