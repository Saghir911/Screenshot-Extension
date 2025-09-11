// content-script.ts
(() => {
  console.log("[content] injected");
  let scrollY = 0;
  let viewportHeight = window.innerHeight;
  let isCapturing = false;
  let lastCapturedScrollY: number | null = null; // remember last captured position
  let maxScrolls = 0;
  let scrollCount: number = 0;
  let scrollType: string = "";

  // function findHeaderElement(): HTMLElement | null {
  //   const candidates = Array.from(document.querySelectorAll<HTMLElement>("*"));
  //   for (const el of candidates) {
  //     const style = window.getComputedStyle(el);
  //     const isFixed = style.position === "sticky" || style.position === "fixed";
  //     if (isFixed) {
  //       return el;
  //     }
  //   }
  //   return null;
  // }

  // const header = findHeaderElement();
  // if (header) {
  //   console.log("Detected header:", header);
  //   header.style.position = "static";
  //   header.style.display = "none";
  //   header.style.background = "royalblue";
  //   console.log("this is me");
  // }

  function removeHeadersFromYoutube() {
    const headerContainer = document.querySelector(
      "#masthead-container"
    ) as HTMLElement | null;
    const ironSelector = document.querySelector(
      "iron-selector"
    ) as HTMLElement | null;
    const Wrapper = document.getElementById(
      "frosted-glass"
    ) as HTMLElement | null;

    if (
      window &&
      window.location &&
      window.location.hostname.includes("youtube.com")
    ) {
      console.log("Header Detected:", headerContainer);
      // headerContainer.style.display = "none";
      if (headerContainer) headerContainer.remove();
      if (ironSelector) ironSelector.remove();
      if (Wrapper) Wrapper.remove();
    }
  }

  // Checking the type of scroll
  function checkScrollType(initialHeight: number, totalHeight: number) {
    if (window.location.hostname.includes("youtube.com")) {
      removeHeadersFromYoutube();
    }
    if (initialHeight < totalHeight) {
      setScrollLimits("Infinite");
      return "Infinite";
    } else {
      setScrollLimits("Fixed");
      return "Fixed";
    }
  }
  // Setting the limits if webpage has infinite scroll
  function setScrollLimits(type: "Infinite" | "Fixed") {
    if (type === "Infinite") {
      scrollType = type;
      console.log("check scroll type:", scrollType);
      maxScrolls = 3;
    } else {
      scrollType = type;
      console.log("check scroll type:", scrollType);
      maxScrolls = Number.POSITIVE_INFINITY;
    }
  }

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
        chrome.runtime.sendMessage({ action: "CapturingComplete" });

        console.log(
          "✅ [content] Finished capturing full page (duplicate detected)"
        );
        return;
      }

      // Mark this position as captured and request capture
      lastCapturedScrollY = currentScroll;

      const initialHeight = document.body.scrollHeight;
      checkScrollType(initialHeight, totalHeight);

      chrome.runtime.sendMessage({ action: "capture" });
    }, 800); // increase if the page needs more time to lazy-load
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "startCapturing") {
      // initialize
      isCapturing = true;
      viewportHeight = window.innerHeight;
      scrollY = 0;
      lastCapturedScrollY = null;
      scrollCount = 0;

      // immediately perform initial scroll+capture (scroll to top then capture)
      scrollAndRequestCapture();

      sendResponse({ status: "started" });
      return true;
    }

    if (msg.action === "scrollNext") {
      console.log(msg.action);
      if (!isCapturing) {
        sendResponse({ status: "not-capturing" });
        return true;
      }

      if (scrollCount >= maxScrolls) {
        isCapturing = false;
        chrome.runtime.sendMessage({ action: "CapturingComplete" });
        sendResponse({ status: "done" });
        return;
      }
      scrollCount++;
      console.log("no of scrolls:", scrollCount);

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

    if (msg.action === "combine") {
      const images: string[] = msg.images;
      console.log("images recieved", msg.images);
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

            const pageHeight = Math.max(
              document.documentElement.scrollHeight,
              document.body.scrollHeight
            );

            const imgWidth = loadedImages[0].img.naturalWidth - 15;
            const totalHeightExceptLast = loadedImages
              .slice(0, -1)
              .reduce((sum, item) => sum + item.height, 0);

            const lastImg = loadedImages[loadedImages.length - 1];
            const lastTrimHeight = pageHeight - totalHeightExceptLast;

            canvas.width = imgWidth;
            scrollType === "Infinite"
              ? (canvas.height = viewportHeight * maxScrolls)
              : (canvas.height = totalHeightExceptLast + lastTrimHeight);

            let yOffset = 0;
            // Draw all except last
            for (let i = 0; i < loadedImages.length - 1; i++) {
              ctx.drawImage(loadedImages[i].img, 0, yOffset);
              yOffset += loadedImages[i].height;
            }

            // Draw **bottom part of last image**
            const trimTop = lastImg.height - lastTrimHeight; // how much to skip from top
            console.log("trip top", trimTop);
            if (scrollType === "Infinite") {
              ctx.drawImage(
                lastImg.img,
                0,
                yOffset,
                lastImg.img.naturalWidth - 15,
                viewportHeight + maxScrolls // destination
              );
            } else {
              ctx.drawImage(
                lastImg.img,
                0,
                trimTop,
                lastImg.img.naturalWidth - 15,
                lastTrimHeight, // source (skip top)
                0,
                yOffset,
                lastImg.img.naturalWidth - 15,
                lastTrimHeight // destination
              );
            }

            const finalUrl = canvas.toDataURL("image/png");
            // console.log("this is final link", finalUrl);
            chrome.runtime.sendMessage({ action: "OpenPage", finalUrl });
            console.log(
              "✅ Finished merging screenshots (bottom-trim last image)"
            );
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
