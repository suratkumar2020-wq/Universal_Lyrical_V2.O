// public/background.js - Universal Lyrics Pro Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log("Universal Lyrics Pro 2.0 initialized.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // ── Open floating window (optionally pinned always-on-top) ──────────────
  if (message?.type === 'OPEN_FLOATING_WINDOW') {
    const alwaysOnTop = message.alwaysOnTop === true;
    try {
      const createProps = {
        url: chrome.runtime.getURL('index.html?window=true'),
        type: 'popup',
        width: 400,
        height: 660,
        focused: true,
        ...(alwaysOnTop ? { alwaysOnTop: true } : {})
      };
      if (chrome.windows?.create) {
        chrome.windows.create(createProps, (newWindow) => {
          if (chrome.runtime.lastError) {
            chrome.tabs.create({ url: createProps.url });
            sendResponse({ success: false, fallback: 'tab', error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ success: true, windowId: newWindow?.id });
          }
        });
      } else {
        chrome.tabs.create({ url: createProps.url });
        sendResponse({ success: false, fallback: 'tab' });
      }
    } catch (err) {
      try { chrome.tabs.create({ url: chrome.runtime.getURL('index.html?window=true') }); } catch { /* ignore */ }
      sendResponse({ success: false, error: String(err) });
    }
    return true; // Async channel
  }

  // ── Toggle always-on-top on an existing window ──────────────────────────
  if (message?.type === 'SET_ALWAYS_ON_TOP') {
    const { windowId, enabled } = message;
    if (!windowId || !chrome.windows?.update) {
      sendResponse({ success: false, error: 'windows API unavailable or no windowId' });
      return false;
    }
    chrome.windows.update(windowId, { alwaysOnTop: !!enabled }, (updatedWindow) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, alwaysOnTop: updatedWindow?.alwaysOnTop ?? !!enabled });
      }
    });
    return true; // Async channel
  }

  return false;
});
