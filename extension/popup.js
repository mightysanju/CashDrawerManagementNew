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
});
