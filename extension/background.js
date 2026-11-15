// FrontDesk Pro — Background Service Worker
// Automatically injects content scripts into existing tabs upon install/update
// and coordinates cross-tab log synchronization.

async function injectIntoOpenTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (
        tab.id &&
        tab.url &&
        !tab.url.startsWith('chrome://') &&
        !tab.url.startsWith('chrome-extension://') &&
        !tab.url.startsWith('edge://') &&
        !tab.url.startsWith('about:') &&
        !tab.url.startsWith('devtools://')
      ) {
        try {
          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ['content.css'],
          });
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js'],
          });
        } catch {
          // Ignore tabs that disallow scripting or are protected
        }
      }
    }
  } catch (err) {
    console.warn('FrontDesk Pro background injection error:', err);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  injectIntoOpenTabs();
});

chrome.runtime.onStartup.addListener(() => {
  injectIntoOpenTabs();
});

// Relay messages between tabs
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.type === 'FDP_LOG_CREATED') {
    // Notify all tabs (including FrontDesk Pro dashboard tabs)
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id && tab.id !== sender?.tab?.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'FDP_NEW_LOG_BROADCAST',
            log: request.log,
          }).catch(() => {});
        }
      }
    });
    sendResponse({ received: true });
    return true;
  }

  if (request && request.type === 'FDP_USER_CHANGED') {
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id && tab.id !== sender?.tab?.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'FDP_USER_SYNC_BROADCAST',
            user: request.user,
          }).catch(() => {});
        }
      }
    });
    sendResponse({ received: true });
    return true;
  }
});
