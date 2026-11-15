document.addEventListener('DOMContentLoaded', async () => {
  const staffNameEl = document.getElementById('staff-name');
  const openAppBtn = document.getElementById('open-app-btn');

  // Load stored staff profile if present
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const res = await chrome.storage.local.get(['frontdesk_user']);
    if (res && res.frontdesk_user) {
      staffNameEl.textContent = `${res.frontdesk_user.fullName} (${res.frontdesk_user.role})`;
    }
  }

  // Open App in tab
  openAppBtn.addEventListener('click', async () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      await chrome.tabs.create({ url: 'http://localhost:5173/app' });
    } else {
      window.open('http://localhost:5173/app', '_blank');
    }
  });
});
