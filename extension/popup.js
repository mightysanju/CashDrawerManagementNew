document.addEventListener('DOMContentLoaded', async () => {
  const staffNameEl = document.getElementById('staff-name');
  const openAppBtn = document.getElementById('open-app-btn');

  // Load stored staff profile if present
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const res = await chrome.storage.local.get(['frontdesk_user']);
    if (res && res.frontdesk_user && res.frontdesk_user.fullName) {
      staffNameEl.textContent = `${res.frontdesk_user.fullName} (${res.frontdesk_user.role})`;
      staffNameEl.style.color = '#0f172a';
    } else {
      staffNameEl.textContent = 'Not Signed In ⚠️';
      staffNameEl.style.color = '#dc2626';
    }
  }

  // Open App in tab
  openAppBtn.addEventListener('click', async () => {
    const appUrl = 'https://cashdrawermanagement.netlify.app/app';
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      await chrome.tabs.create({ url: appUrl });
    } else {
      window.open(appUrl, '_blank');
    }
  });
});
