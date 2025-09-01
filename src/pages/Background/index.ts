// background.ts (service worker)
let isCapturing = false;
let targetTabId: number | null = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "beginCapture" && msg.tabId) {
    targetTabId = msg.tabId as number;
    isCapturing = true;

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
    targetTabId = null;

    // Get the full array and send it in the response
    chrome.storage.local.get("screenshotUrls", (result) => {
      const urls: string[] = Array.isArray(result.screenshotUrls)
        ? result.screenshotUrls
        : [];

      // send the "done" message along with the array
      sendResponse({ status: "stopped", screenshots: urls });

      console.log("✅ [background] Done capturing. Screenshots:", urls);
      if (targetTabId !== null) {
        chrome.tabs.sendMessage(
          targetTabId,
          { action: "combine", images: urls },
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
    });

    // return true to indicate async sendResponse
    return true;
  } else if (msg.action === "OpenPage  ") {
    chrome.tabs.create({ url: msg.finalUrl });
    sendResponse({ status: "Page is Opened" });
    return true;
  }
  return false;
});

/** Ensure the content script is present and send startCapturing to it. */
function startContentScriptAndBegin(tabId: number) {
  // First try sending message
  chrome.tabs.sendMessage(tabId, { action: "startCapturing" }, (res) => {
    if (chrome.runtime.lastError) {
      console.warn(
        "[background] content script not found; injecting...",
        chrome.runtime.lastError.message
      );

      // Inject and then try again
      // chrome.scripting.executeScript(
      //   { target: { tabId }, files: ["content-script.js"] },
      //   () => {
      //     // If injection fails for some reason, chrome.runtime.lastError would be set on the next sendMessage too
      //     chrome.tabs.sendMessage(tabId, { action: "startCapturing" }, (res2) => {
      //       if (chrome.runtime.lastError) {
      //         console.error("[background] failed to start after injection:", chrome.runtime.lastError.message);
      //         isCapturing = false;
      //         targetTabId = null;
      //       }
      //     })
      //   }
      // )
    }
  });
}

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
          // Get the existing array from storage (or create a new one)
          chrome.storage.local.get("screenshotUrls", (result) => {
            const urls: string[] = Array.isArray(result.screenshotUrls)
              ? result.screenshotUrls
              : [];

            // Append the new screenshot
            urls.push(dataUrl);

            // Optionally persist the screenshot
            chrome.storage.local.set({ screenshotUrls: urls }, () => {
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
            });
          });
        }
      );
    } catch (err) {
      reject(err);
    }
  });
}
