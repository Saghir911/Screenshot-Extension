// chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//   if (msg.action === "takeScreenshot") {
//     console.log("message received from Content ", "message:", msg.action);
//     sendResponse({ status: "takeScreenshot" });

//     chrome.tabs.captureVisibleTab(
//       chrome.windows.WINDOW_ID_CURRENT,
//       { format: "png" },
//       (dataUrl: string | undefined) => {
//         if (chrome.runtime.lastError) {
//           console.error("captureVisibleTab error:", chrome.runtime.lastError);

//           return;
//         }
//         if (!dataUrl) {
//           const err = new Error("No dataUrl returned from captureVisibleTab");
//           console.error(err.message);

//           return;
//         }
//         // You can do something with the screenshot dataUrl here, e.g., send it back to the content script or save it
//         console.log("Screenshot taken:", dataUrl.substring(0, 30) + "...");
//       }
//     );

//     // console.log("count:", msg.tries);

//     chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//       const tab = tabs[0];
//       if (tab?.id) {
//         chrome.tabs.sendMessage(tab.id, { action: "scrollNext" });
//       } else {
//         console.error("No active tab found");
//       }
//     });

//     console.log("We are done now 🎉🎉🎉");
//   }
//   return true;
// });

// background.ts (service worker)
let isCapturing = false;
let targetTabId: number | null = null;
let screenshotUrls: string[] = [];
let lastFinalUrl: string | null = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("msg in background", msg, sender, sendResponse);
  if (msg.action === "capture") {
    //   if (isCapturing && targetTabId === msg.tabId) {
    //     sendResponse({ status: "already-capturing" });
    //     return true;
    //   }
    targetTabId = sender.tab?.id as number;
    isCapturing = true;

    if (typeof targetTabId !== "number") {
      console.log("targetTabId", targetTabId);
      sendResponse({ status: "no-valid-tab" });
      return true;
    }

    console.log("we are capturing in that tab:", targetTabId);

    if (!isCapturing) {
      sendResponse({ status: "not-capturing" });
      return true;
    }
    console.log("I surpass the isCapturing condition");
    // startContentScriptAndBegin(targetTabId);

    // perform capture
    captureVisibleAndSend(targetTabId)
      .then(() => sendResponse({ status: "captured" }))
      .catch((err) => sendResponse({ status: "error", message: String(err) }));
    return true; // indicate async response
  }

  if (msg.action === "CapturingComplete") {
    isCapturing = false;

    sendResponse({ status: "stopped", screenshots: screenshotUrls });

    console.log(
      "✅ [background] Done capturing. Screenshots:",
      screenshotUrls,
      targetTabId
    );
    if (targetTabId !== null && typeof targetTabId === "number") {
      // Verify the tab still exists before sending message
      chrome.tabs.get(targetTabId, () => {
        if (chrome.runtime.lastError) {
          console.warn(
            "[background] tab no longer exists when trying to send combine message:",
            chrome.runtime.lastError.message
          );
          targetTabId = null;
          screenshotUrls = [];
          return;
        }

        chrome.tabs.sendMessage(
          targetTabId!,
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
      });
      targetTabId = null;
      screenshotUrls = [];
    }

    return true;
  } else if (msg.action === "OpenPage") {
    // console.log("final link", msg.finalUrl);
    // store it at top-level
    lastFinalUrl = msg.finalUrl;

    // open the capture page
    chrome.tabs.create({
      url: chrome.runtime.getURL("Screenshot/capture.html"),
    });

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

// /** Send startCapturing with retries to handle transient no-receiver errors. */
// function sendStartCapturingWithRetry(
//   tabId: number,
//   maxRetries: number = 5,
//   delayMs: number = 200
// ): Promise<void> {
//   return new Promise((resolve, reject) => {
//     let attempt = 0;

//     const trySend = () => {
//       chrome.tabs.sendMessage(tabId, { action: "startCapturing" }, () => {
//         if (!chrome.runtime.lastError) {
//           resolve();
//           return;
//         }
//         const message = chrome.runtime.lastError.message || "";
//         const isNoReceiver =
//           message.includes("Receiving end does not exist") ||
//           message.includes("Could not establish connection");
//         if (isNoReceiver && attempt < maxRetries) {
//           attempt++;
//           setTimeout(trySend, delayMs);
//           return;
//         }
//         reject(chrome.runtime.lastError);
//       });
//     };

//     trySend();
//   });
// }

/** Ensure the content script is present and send startCapturing to it. */
// function startContentScriptAndBegin(tabId: number) {
//   console.log("[background] injecting content script into tab", tabId);

//   // Simply inject the content script
//   chrome.scripting.executeScript(
//     { target: { tabId }, files: ["contentScript.bundle.js"] },
//     () => {
//       if (chrome.runtime.lastError) {
//         console.error(
//           "[background] failed to inject content script:",
//           chrome.runtime.lastError.message
//         );
//         isCapturing = false;
//         targetTabId = null;
//         return;
//       }
//       console.log("[background] content script injected successfully");
//     }
//   );
// }

/** Capture the visible tab and forward screenshot back to content script as scrollNext.
 *  tabId here is guaranteed to be a number.
 */
function captureVisibleAndSend(tabId: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      console.log("hi i am working");
      chrome.tabs.captureVisibleTab(
        chrome.windows.WINDOW_ID_CURRENT,
        { format: "png" },
        (dataUrl: string | undefined) => {
          console.log("url of screenshot:", dataUrl);
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

          // Optionally persist the screenshot

          // Ensure tab still exists before sending the message
          chrome.tabs.get(tabId, () => {
            if (chrome.runtime.lastError) {
              console.warn(
                "[background] tab no longer available; stopping capture",
                chrome.runtime.lastError.message
              );
              isCapturing = false;
              targetTabId = null;
              resolve();
              return;
            }

            // send message to the content script to perform the next scroll
            console.log("[background] sending scrollNext to tab", tabId);

            // Ensure tabId is a valid number before sending message
            if (typeof tabId !== "number" || tabId <= 0) {
              console.error("[background] invalid tabId:", tabId);
              isCapturing = false;
              targetTabId = null;
              reject(new Error(`Invalid tabId: ${tabId}`));
              return;
            }

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              const tab = tabs[0];
              if (tab?.id) {
                chrome.tabs.sendMessage(
                  tab.id,
                  { action: "scrollNext" },
                  (res: any) => {
                    if (chrome.runtime.lastError) {
                      console.warn(
                        "[background] scrollNext message error:",
                        chrome.runtime.lastError.message
                      );
                    }
                    resolve();
                  }
                );
              } else {
                console.error("No active tab found");
                resolve();
              }
            });
          });
        }
      );
    } catch (err: any) {
      reject(err);
    }
  });
}
