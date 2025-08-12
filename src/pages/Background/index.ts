chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "capture") {
    chrome.tabs.captureVisibleTab(
      chrome.windows.WINDOW_ID_CURRENT,
      { format: "png" },
      (dataUrl) => {
        if (dataUrl) {
          chrome.storage.local.set({ screenshotUrl: dataUrl }, () => {
            // Open custom page
            chrome.tabs.create({
              url: chrome.runtime.getURL("Screenshot/Capture.html"),
            });
          });
        }
      }
    );
  }
  return true;
});
