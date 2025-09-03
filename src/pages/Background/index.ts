// background.ts (service worker)
let isCapturing = false;
let targetTabId: number | null = null;
let screenshotUrls: string[] = [];
let lastFinalUrl: string | null = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "beginCapture" && msg.tabId) {
    targetTabId = msg.tabId as number;
    isCapturing = true;
    
    // Reset previous data
    screenshotUrls = [];
    lastFinalUrl = null;

    startContentScriptAndBegin(targetTabId);
    sendResponse({ status: "beginRequested" });
    return true;
  }

  if (msg.action === "capture") {
    const maybeTabId = sender.tab?.id ?? msg.tabId ?? targetTabId;
    if (typeof maybeTabId !== "number") {
      sendResponse({ status: "no-valid-tab" });
      return true;
    }
    const tabId = maybeTabId;

    if (!isCapturing) {
      sendResponse({ status: "not-capturing" });
      return true;
    }

    // perform capture
    captureVisibleAndSend(tabId)
      .then(() => sendResponse({ status: "captured" }))
      .catch((err) => sendResponse({ status: "error", message: String(err) }));
    return true; // indicate async response
  }

  if (msg.action === "done") {
    isCapturing = false;

    sendResponse({ status: "stopped", screenshots: screenshotUrls });

    console.log("✅ [background] Done capturing. Screenshots:", screenshotUrls);
    if (targetTabId !== null) {
      chrome.tabs.sendMessage(
        targetTabId,
        { action: "combine", images: screenshotUrls },
        (res) => {
          if (chrome.runtime.lastError) {
            console.warn(
              "[background] combine message not received:",
              chrome.runtime.lastError.message
            );
          }
        }
      );
    }
    return true;
  } else if (msg.action === "OpenPage") {
    console.log("final url:", msg.finalUrl);
    
    // Only store and open if we don't already have this URL stored
    if (lastFinalUrl !== msg.finalUrl) {
      lastFinalUrl = msg.finalUrl;
      
      // open the capture page
      chrome.tabs.create({
        url: chrome.runtime.getURL("Screenshot/capture.html"),
      });
    }

    // Reset capturing state and cleanup
    targetTabId = null;
    screenshotUrls = [];
    isCapturing = false;

    sendResponse({ status: "Page is Opened" });
    return true;
  }

  // handle getUrl anywhere inside same listener
  if (msg.action === "getUrl") {
    // respond with the stored value
    sendResponse({ url: lastFinalUrl }); // could be null if not set
    return true;
  }
});

/** Ensure the content script is present and send startCapturing to it. */
function startContentScriptAndBegin(tabId: number) {
  console.log("this is tab we are targeting:", tabId);
  console.log(targetTabId);

  
  
  // Inject content script first
  chrome.scripting.executeScript(
    { target: { tabId }, files: ["contentScript.bundle.js"] },
    () => {
      if (chrome.runtime.lastError) {
        console.error(
          "[background] Failed to inject content script:",
          chrome.runtime.lastError.message
        );
        isCapturing = false;
        targetTabId = null;
      } else {
        console.log(
          "[background] Content script injected, waiting for ready..."
        );
        // Now wait for "contentReady" message (handled below)
      }
    }
  );
}

// Listen for "contentReady" from the content script
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action === "contentReady" && sender.tab?.id === targetTabId) {
    console.log("[background] Content script ready, starting capture...");
    chrome.tabs.sendMessage(sender.tab.id, { action: "startCapturing" });
  }
});

/** Capture the visible tab and forward screenshot back to content script as scrollNext.
 *  tabId here is guaranteed to be a number.
 */
function captureVisibleAndSend(tabId: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      chrome.tabs.captureVisibleTab(
        chrome.windows.WINDOW_ID_CURRENT,
        { format: "png" },
        (dataUrl) => {
          if (chrome.runtime.lastError) {
            console.error(
              "[background] captureVisibleTab error:",
              chrome.runtime.lastError
            );
            reject(chrome.runtime.lastError);
            return;
          }
          if (!dataUrl) {
            reject(new Error("No dataUrl returned"));
            return;
          }
          screenshotUrls.push(dataUrl);

          // send message to the content script to perform the next scroll
          chrome.tabs.sendMessage(
            tabId,
            { action: "scrollNext", dataURI: dataUrl },
            (res) => {
              if (chrome.runtime.lastError) {
                // content script disappeared (tab closed / navigated) -> stop capturing
                console.error(
                  "[background] sendMessage(scrollNext) error:",
                  chrome.runtime.lastError.message
                );
                isCapturing = false;
                targetTabId = null;
                reject(chrome.runtime.lastError);
                return;
              }

              // If content script told us it's not capturing anymore, flip the flag
              if (res && res.status === "not-capturing") {
                isCapturing = false;
                targetTabId = null;
              }
              resolve();
            }
          );
        }
      );
    } catch (err) {
      reject(err);
    }
  }); 
}