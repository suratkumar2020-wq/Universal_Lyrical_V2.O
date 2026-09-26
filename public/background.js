// public/background.js - Universal Lyrics Pro Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log("Universal Lyrics Pro 2.0 initialized.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // ── Open floating window, then optionally pin it always-on-top ──────────
  // chrome.windows.create does NOT accept alwaysOnTop — we must call
  // windows.update() in the callback AFTER creation. Two-step approach.
  if (message?.type === 'OPEN_FLOATING_WINDOW') {
    const alwaysOnTop = message.alwaysOnTop === true;

    const url = chrome.runtime.getURL('index.html?window=true');

    if (!chrome.windows?.create) {
      // Fallback: open as tab
      chrome.tabs.create({ url });
      sendResponse({ success: false, fallback: 'tab' });
      return false;
    }

    chrome.windows.create(
      { url, type: 'popup', width: 400, height: 660, focused: true },
      (newWindow) => {
        if (chrome.runtime.lastError || !newWindow?.id) {
          // Window creation failed — fall back to tab
          chrome.tabs.create({ url });
          sendResponse({ success: false, fallback: 'tab', error: chrome.runtime.lastError?.message });
          return;
        }

        const winId = newWindow.id;

        if (alwaysOnTop) {
          // Step 2: set alwaysOnTop now that the window exists
          chrome.windows.update(winId, { alwaysOnTop: true }, (updated) => {
            const pinnedOk = !chrome.runtime.lastError && !!updated?.alwaysOnTop;
            sendResponse({ success: true, windowId: winId, alwaysOnTop: pinnedOk });
          });
        } else {
          sendResponse({ success: true, windowId: winId, alwaysOnTop: false });
        }
      }
    );
    return true; // Keep message channel open for async sendResponse
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
        // Read back the actual state — Chrome may silently ignore on some OS/builds
        chrome.windows.get(windowId, (win) => {
          const actual = !!win?.alwaysOnTop;
          sendResponse({ success: true, alwaysOnTop: actual });
        });
      }
    });
    return true; // Async channel
  }

  // ── Get current window's alwaysOnTop state ──────────────────────────────
  if (message?.type === 'GET_WINDOW_STATE') {
    const { windowId } = message;
    if (!windowId || !chrome.windows?.get) {
      sendResponse({ success: false });
      return false;
    }
    chrome.windows.get(windowId, (win) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, alwaysOnTop: !!win?.alwaysOnTop, type: win?.type });
      }
    });
    return true;
  }

  return false;
});
