// content-script.ts
(() => {
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
      const images: string[] = msg.images;
      if (!images || images.length === 0) return;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("Canvas context not available");
        return;
      }

      let loadedImages: { img: HTMLImageElement; height: number }[] = [];
      let loadCount = 0;

      images.forEach((src: string, index: number) => {
        const image = new Image();
        image.src = src;

        image.onload = () => {
          loadedImages[index] = { img: image, height: image.naturalHeight };
          loadCount++;

          if (loadCount === images.length) {
            // Step-driven merge function
            const stitchScreenshots = () => {
              const pageHeight = Math.max(
                document.documentElement.scrollHeight,
                document.body.scrollHeight
              );

              const imgWidth = loadedImages[0].img.naturalWidth;
              const totalHeightExceptLast = loadedImages
                .slice(0, -1)
                .reduce((sum, item) => sum + item.height, 0);

              const lastImg = loadedImages[loadedImages.length - 1];
              const lastTrimHeight = pageHeight - totalHeightExceptLast;

              canvas.width = imgWidth;
              canvas.height = totalHeightExceptLast + lastTrimHeight;

              let yOffset = 0;
              // Draw all except last
              for (let i = 0; i < loadedImages.length - 1; i++) {
                ctx.drawImage(loadedImages[i].img, 0, yOffset);
                yOffset += loadedImages[i].height;
              }

              // Draw **bottom part of last image**
              const trimTop = lastImg.height - lastTrimHeight; // how much to skip from top
              ctx.drawImage(
                lastImg.img,
                0,
                trimTop,
                lastImg.img.naturalWidth,
                lastTrimHeight, // source (skip top)
                0,
                yOffset,
                lastImg.img.naturalWidth,
                lastTrimHeight // destination
              );

              const finalUrl = canvas.toDataURL("image/png");
              chrome.runtime.sendMessage({ action: "OpenPage", finalUrl });
              console.log(
                "✅ Finished merging screenshots (bottom-trim last image)"
              );
            };

            stitchScreenshots();
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
