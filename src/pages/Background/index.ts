chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab?.id ?? msg.tabId;
  console.log(tabId);
  let keepTakingScreenshot = false;
  if (msg.action === "capture") {
    sendResponse(sender.tab?.id);
    keepTakingScreenshot = true;
    capture(tabId, keepTakingScreenshot);
    return true;
  }

  if (msg.action === "done") {
    console.log("Finish taking screenshots");
    // keepTakingScreenshot = false;
    // capture(tabId, keepTakingScreenshot);
  }
});

function capture(tabId: number | any, condition: boolean) {
  if (!condition) return;
  chrome.tabs.captureVisibleTab(
    chrome.windows.WINDOW_ID_CURRENT,
    { format: "png" },
    (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error("captureVisibleTab error:", chrome.runtime.lastError);
        return;
      }
      if (dataUrl && tabId !== undefined) {
        chrome.storage.local.set({ screenshotUrl: dataUrl }, () => {
          chrome.tabs.sendMessage(
            tabId,
            {
              action: "scrollNext",
              dataURI: dataUrl,
            },
            () => {
              if (chrome.runtime.lastError) {
                console.error(
                  "sendMessage(scrollNext) error:",
                  chrome.runtime.lastError
                );
              }
            }
          );
        });
      }
    }
  );
}
