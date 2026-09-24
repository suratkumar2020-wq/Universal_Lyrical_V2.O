// public/background.js - Universal Lyrics Pro Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log("Universal Lyrics Pro 2.0 initialized.");
});

// Support opening in dedicated floating window
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'OPEN_FLOATING_WINDOW') {
    chrome.windows.create({
      url: chrome.runtime.getURL('index.html?window=true'),
      type: 'popup',
      width: 400,
      height: 660,
      focused: true
    }, (newWindow) => {
      sendResponse({ success: true, windowId: newWindow?.id });
    });
    return true; // Async channel
  }
});