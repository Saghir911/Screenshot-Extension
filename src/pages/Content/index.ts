// content-script.ts
(() => {
  let remainingHeight: number | any = 0;
  chrome.runtime.sendMessage({ action: "contentReady" });
  console.log("[content] injected");
  let scrollY = 0;
  let viewportHeight = window.innerHeight;
  let isCapturing = false;
  let lastCapturedScrollY: number | null = null; // remember last captured position

  function clampScrollY(y: number) {
    const totalHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    );
    const maxScroll = Math.max(0, totalHeight - viewportHeight);
    return Math.min(Math.max(0, y), maxScroll);
  }

  /**
   * Scroll to `scrollY`, wait for paint, then request a capture unless we've already captured
   * at this same visible position. This ensures the final partial viewport is captured once.
   */
  function scrollAndRequestCapture() {
    if (!isCapturing) return;

    const totalHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    );
    const maxScroll = Math.max(0, totalHeight - viewportHeight);

    console.log("[content] scrollAndRequestCapture", {
      requestedScrollY: scrollY,
      viewportHeight,
      totalHeight,
      maxScroll,
    });

    // Always attempt to scroll to the target (even if target === maxScroll)
    window.scrollTo({ top: scrollY, left: 0, behavior: "auto" });

    // Give page time to paint, lazy-load, reflow
    setTimeout(() => {
      if (!isCapturing) return;

      const currentScroll = window.scrollY;
      console.log(
        "[content] after scroll, window.scrollY =",
        currentScroll,
        "lastCaptured =",
        lastCapturedScrollY
      );

      // If we already captured this exact visible position, then we are done.
      if (
        lastCapturedScrollY !== null &&
        currentScroll === lastCapturedScrollY
      ) {
        // Nothing new to capture -> finish
        isCapturing = false;
        chrome.runtime.sendMessage({ action: "done" }, () => {});

        console.log(
          "✅ [content] Finished capturing full page (duplicate detected)"
        );
        return;
      }

      // Mark this position as captured and request capture
      lastCapturedScrollY = currentScroll;
      chrome.runtime.sendMessage({ action: "capture" }, () => {});
    }, 800); // increase if the page needs more time to lazy-load
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "startCapturing") {
      // initialize
      isCapturing = true;
      viewportHeight = window.innerHeight;
      scrollY = 0;
      lastCapturedScrollY = null;

      // immediately perform initial scroll+capture (scroll to top then capture)
      scrollAndRequestCapture();

      sendResponse({ status: "started" });
      return true;
    }

    if (msg.action === "scrollNext") {
      if (!isCapturing) {
        sendResponse({ status: "not-capturing" });
        return true;
      }

      // recompute based on the *current* visible position so we don't fight user's manual scroll
      viewportHeight = window.innerHeight;

      // compute next target and clamp to available scroll range
      const nextTarget = clampScrollY(window.scrollY + viewportHeight);
      scrollY = nextTarget;

      // always attempt to scroll to `scrollY` and request capture (the function will detect duplicates)
      scrollAndRequestCapture();

      sendResponse({ status: "scrolled", scrollY });
      return true;
    }

    if (msg.action === "stopCapturing") {
      isCapturing = false;
      sendResponse({ status: "stopped" });
      return true;
    }
    if (msg.action === "combine") {
      console.log("these are urls of screenshots", msg.images);
      console.log(msg.action);
      const images: string[] = msg.images;
      if (!images || images.length === 0) return;
      const pageHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      );
      remainingHeight = pageHeight - viewportHeight * (images.length - 1);
      console.log(remainingHeight);

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      let loadedImages: HTMLImageElement[] = [];
      let loadCount = 0;

      images.forEach((src: string, index: number) => {
        const image = new Image();
        image.src = src;

        image.onload = () => {
          loadedImages[index] = image;
          loadCount++;

          if (loadCount === images.length) {
            const imgWidth = loadedImages[0].naturalWidth;
            const canvasHeight = loadedImages.reduce(
              (sum, img) => sum + img.height,
              0
            );
            canvas.width = imgWidth;
            canvas.height = canvasHeight;

            let yOffset = 0;
            loadedImages.forEach((img) => {
              ctx.drawImage(img, 0, yOffset);
              yOffset += img.height;
            });

            const finalUrl = canvas.toDataURL("image/png");
            console.log("final url of images:", finalUrl);
            chrome.runtime.sendMessage({ action: "OpenPage", finalUrl });
          }
        };

        image.onerror = () => {
          console.warn(`Failed to load image at index ${index}`);
          loadCount++;
        };
      });
      sendResponse({ status: "combined" });
      return true;
    }
    // ignore others
  });
})();
