chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action === "capture") {
    chrome.tabs.captureVisibleTab(
      chrome.windows.WINDOW_ID_CURRENT,
      { format: "png" },
      (dataUrl) => {
        console.log("Data", dataUrl);
        if (chrome.runtime.lastError) {
          console.error("captureVisibleTab error:", chrome.runtime.lastError);
          return;
        }
        const tabId = sender.tab?.id ?? msg.tabId;
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
    return true;
  }

  if (msg.action === "done") {
    console.log("Capture done");
    chrome.tabs.create({
      url: chrome.runtime.getURL("Screenshot/Capture.html"),
    });
  }
});
