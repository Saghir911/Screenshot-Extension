chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "takeScreenshot") {
    console.log("message received from Content ", "message:", msg.action);
    sendResponse({ status: "takeScreenshot" });

    chrome.tabs.captureVisibleTab(
      chrome.windows.WINDOW_ID_CURRENT,
      { format: "png" },
      (dataUrl: string | undefined) => {
        if (chrome.runtime.lastError) {
          console.error("captureVisibleTab error:", chrome.runtime.lastError);

          return;
        }
        if (!dataUrl) {
          const err = new Error("No dataUrl returned from captureVisibleTab");
          console.error(err.message);

          return;
        }
        // You can do something with the screenshot dataUrl here, e.g., send it back to the content script or save it
        console.log("Screenshot taken:", dataUrl.substring(0, 30) + "...");
      }
    );

    // console.log("count:", msg.tries);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { action: "scrollNext" });
      } else {
        console.error("No active tab found");
      }
    });

    console.log("We are done now 🎉🎉🎉");
  }
  return true;
});

// // background.ts (service worker)
// let isCapturing = false;
// let targetTabId: number | null = null;
// let screenshotUrls: string[] = [];
// let lastFinalUrl: string | null = null;

// chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//   if (msg.action === "beginCapture" && msg.tabId) {
//     // Ignore duplicate begin requests if a capture is already in progress for this tab
//     if (isCapturing && targetTabId === msg.tabId) {
//       sendResponse({ status: "already-capturing" });
//       return true;
//     }
//     targetTabId = msg.tabId as number;
//     isCapturing = true;

//     startContentScriptAndBegin(targetTabId);
//     sendResponse({ status: "beginRequested" });
//     return true;
//   }

//   if (msg.action === "capture") {
//     const maybeTabId = sender.tab?.id ?? msg.tabId ?? targetTabId;
//     if (typeof maybeTabId !== "number") {
//       sendResponse({ status: "no-valid-tab" });
//       return true;
//     }
//     const tabId = maybeTabId;

//     if (!isCapturing) {
//       sendResponse({ status: "not-capturing" });
//       return true;
//     }

//     // perform capture
//     captureVisibleAndSend(tabId)
//       .then(() => sendResponse({ status: "captured" }))
//       .catch((err) => sendResponse({ status: "error", message: String(err) }));
//     return true; // indicate async response
//   }

//   if (msg.action === "CapturingComplete") {
//     isCapturing = false;

//     sendResponse({ status: "stopped", screenshots: screenshotUrls });

//     console.log(
//       "✅ [background] Done capturing. Screenshots:",
//       screenshotUrls,
//       targetTabId
//     );
//     if (targetTabId !== null) {
//       chrome.tabs.sendMessage(
//         targetTabId,
//         { action: "combine", images: screenshotUrls },
//         (res) => {
//           if (chrome.runtime.lastError) {
//             console.warn(
//               "[background] combine message not received:",
//               chrome.runtime.lastError.message
//             );
//           }
//         }
//       );
//       targetTabId = null;
//       screenshotUrls = [];
//     }

//     return true;
//   } else if (msg.action === "OpenPage") {
//     // console.log("final link", msg.finalUrl);
//     // store it at top-level
//     lastFinalUrl = msg.finalUrl;

//     // open the capture page
//     chrome.tabs.create({
//       url: chrome.runtime.getURL("Screenshot/capture.html"),
//     });

//     sendResponse({ status: "Page is Opened" });
//     return true;
//   }

//   // handle getUrl anywhere inside same listener
//   if (msg.action === "getUrl") {
//     // respond with the stored value
//     sendResponse({ url: lastFinalUrl }); // could be null if not set
//     return true;
//   }
// });

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

// /** Ensure the content script is present and send startCapturing to it. */
// function startContentScriptAndBegin(tabId: number) {
//   console.log("hi i am working");
//   // Try to send startCapturing; if content script missing, inject and retry after handshake
//   chrome.tabs.sendMessage(tabId, { action: "startCapturing" }, (res: any) => {
//     if (!chrome.runtime.lastError) return;
//     console.log("I came through pass");

//     // Content script not found, inject it
//     chrome.scripting.executeScript(
//       { target: { tabId }, files: ["contentScript.bundle.js"] },
//       () => {
//         console.log("script is injected!");
//         if (chrome.runtime.lastError) {
//           console.log("script is not injected!");
//           isCapturing = false;
//           targetTabId = null;
//           return;
//         }
//         // Wait for handshake, then send startCapturing again (with retry)
//         const onContentReady = (
//           msg: any,
//           sender: chrome.runtime.MessageSender,
//           sendResponse: any
//         ) => {
//           console.log("message :", msg.action);
//           if (
//             msg &&
//             msg.action === "contentReady" &&
//             sender.tab &&
//             sender.tab.id === tabId
//           ) {
//             console.log("we have contente script injected; starting capture");
//             chrome.runtime.onMessage.removeListener(onContentReady);
//             sendStartCapturingWithRetry(tabId).catch((err) => {
//               console.warn(
//                 "[background] startCapturing retry failed after handshake:",
//                 String(err && (err.message || err))
//               );
//               isCapturing = false;
//               targetTabId = null;
//             });
//           }
//           return true;
//         };
//         chrome.runtime.onMessage.addListener(onContentReady);
//       }
//     );
//   });
// }

// /** Capture the visible tab and forward screenshot back to content script as scrollNext.
//  *  tabId here is guaranteed to be a number.
//  */
// function captureVisibleAndSend(tabId: number): Promise<void> {
//   return new Promise<void>((resolve, reject) => {
//     try {
//       console.log("hi i am working");
//       chrome.tabs.captureVisibleTab(
//         chrome.windows.WINDOW_ID_CURRENT,
//         { format: "png" },
//         (dataUrl: string | undefined) => {
//           if (chrome.runtime.lastError) {
//             console.error(
//               "[background] captureVisibleTab error:",
//               chrome.runtime.lastError
//             );
//             reject(chrome.runtime.lastError);
//             return;
//           }
//           if (!dataUrl) {
//             reject(new Error("No dataUrl returned"));
//             return;
//           }
//           screenshotUrls.push(dataUrl);

//           // Optionally persist the screenshot

//           // Ensure tab still exists before sending the message
//           chrome.tabs.get(tabId, () => {
//             if (chrome.runtime.lastError) {
//               console.warn(
//                 "[background] tab no longer available; stopping capture",
//                 chrome.runtime.lastError.message
//               );
//               isCapturing = false;
//               targetTabId = null;
//               resolve();
//               return;
//             }

//             // send message to the content script to perform the next scroll
//             console.log("[background] sending scrollNext to tab", tabId);
//             chrome.tabs.sendMessage(
//               tabId,
//               { action: "scrollNext", dataURI: dataUrl },
//               (res: any) => {
//                 if (chrome.runtime.lastError) {
//                   // content script disappeared (tab closed / navigated). If the error is the
//                   // common transient "Receiving end does not exist", stop gracefully instead of rejecting
//                   const message = chrome.runtime.lastError.message || "";
//                   const isNoReceiver =
//                     message.includes("Receiving end does not exist") ||
//                     message.includes("Could not establish connection");
//                   if (isNoReceiver) {
//                     console.warn(
//                       "[background] scrollNext receiver missing; stopping capture gracefully"
//                     );
//                     isCapturing = false;
//                     targetTabId = null;
//                     resolve();
//                     return;
//                   }
//                   // otherwise treat as hard error
//                   console.error(
//                     "[background] sendMessage(scrollNext) error:",
//                     message
//                   );
//                   isCapturing = false;
//                   targetTabId = null;
//                   reject(chrome.runtime.lastError);
//                   return;
//                 }

//                 // If content script told us it's not capturing anymore, flip the flag
//                 if (res && res.status === "not-capturing") {
//                   isCapturing = false;
//                   targetTabId = null;
//                 }
//                 resolve();
//               }
//             );
//           });
//         }
//       );
//     } catch (err: any) {
//       reject(err);
//     }
//   });
// }

// // Swallow specific transient connection errors to avoid noisy unhandled promise rejections
// // in the service worker context when messaging races occur.
// // Note: MV3 service workers support global unhandledrejection.
// // eslint-disable-next-line @typescript-eslint/no-explicit-any
// (self as any).addEventListener?.(
//   "unhandledrejection",
//   (event: PromiseRejectionEvent) => {
//     const message = String(
//       (event.reason && (event.reason.message || event.reason)) || ""
//     );
//     if (
//       message.includes("Receiving end does not exist") ||
//       message.includes("Could not establish connection")
//     ) {
//       event.preventDefault();
//       console.warn(
//         "[background] swallowed transient messaging rejection:",
//         message
//       );
//     }
//   }
// );
