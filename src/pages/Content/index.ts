// content-script.ts
(async () => {
  console.log("[content] injected");
  let scrollY = 0;
  let viewportHeight = window.innerHeight;
  let isCapturing = false;
  let lastCapturedScrollY: number | null = null; // remember last captured position
  let maxScrolls = 0;
  let scrollCount: number = 0;
  let scrollType: string = "";

  const youtubeSidebar = await waitForElement<HTMLElement>(
    "#guide-inner-content"
  );

  console.log("sidebar:", youtubeSidebar);

  function waitForElement<T extends HTMLElement>(
    selector: string,
    timeout = 5000
  ): Promise<T | null> {
    return new Promise((resolve) => {
      const start = Date.now();

      const check = () => {
        const el = document.querySelector(selector) as T | null;
        if (el) return resolve(el);

        if (Date.now() - start > timeout) return resolve(null);
        requestAnimationFrame(check);
      };

      check();
    });
  }

  let removeYTHeaders: {
    el: HTMLElement;
    parent: Node;
    next: Node | null;
  }[] = [];
  let removedYTSideBars: {
    el: HTMLElement;
    parent: Node;
    next: Node | null;
  }[] = [];

  function removeHeadersFromYoutube() {
    const elements = [
      document.querySelector("#masthead-container"),
      document.querySelector("iron-selector"),
      document.getElementById("frosted-glass"),
    ];

    elements.forEach((el: any) => {
      if (el) {
        removeYTHeaders.push({
          el,
          parent: el.parentNode!,
          next: el.nextSibling,
        });
        el.remove();
      }
    });
  }

  function restoreHeaders() {
    removeYTHeaders.forEach((item) => {
      if (item.next) {
        item.parent.insertBefore(item.el, item.next);
      } else {
        item.parent.appendChild(item.el);
      }
    });
    removeYTHeaders = [];
  }

  function removedSidebarsFromYoutube() {}
  async function hideAndScrollSidebar(scrollCount: number) {
    if (scrollCount === 1) {
      console.log("[content] scrollYoutubeSidebar for first scroll");
      youtubeSidebar?.scrollBy({
        top: youtubeSidebar.scrollHeight - youtubeSidebar.clientHeight,
        behavior: "auto",
      });
    } else if (youtubeSidebar && scrollCount === 2) {
      try {
        youtubeSidebar.style.display = "none";
        console.log("[content] sidebar hidden");
      } catch (err) {
        console.warn("[content] hideSidebar failed:", err);
      }
    }
  }
  function showSidebar() {
    if (youtubeSidebar) youtubeSidebar.style.display = "initial";
    youtubeSidebar?.scrollTo({ top: 0, behavior: "auto" });
    console.log("[content] sidebar scrolled to top");
  }

  /**
   * Optional visual tweak: scroll the youtube inner scroller (does NOT hide sidebar).
   * We DO NOT hide the sidebar here; hiding is handled in the scrollNext message handler
   * so hide happens *after* the first capture is completed by the background.
   */

  // Checking the type of scroll (Infinite vs Fixed)
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
      maxScrolls = 5;
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
   * Scroll to `scrollY`, wait for paint, then request a capture.
   * This will request the background to capture the visible viewport.
   */
  async function scrollAndRequestCapture(noOfScrolls: number) {
    const totalHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    );
    const maxScroll = Math.max(0, totalHeight - viewportHeight);
    console.log("viewportHeight", viewportHeight);

    console.log("[content] scrollAndRequestCapture", {
      requestedScrollY: scrollY,
      viewportHeight,
      totalHeight,
      maxScroll,
    });

    // Always attempt to scroll to the target (even if target === maxScroll)
    // if(scrollCount === 2){
    //  await hideSidebar()
    // }
    window.scrollTo({ top: scrollY, left: 0, behavior: "auto" });
    await hideAndScrollSidebar(noOfScrolls);

    // REQUEST CAPTURE FROM BACKGROUND (we do not await a callback here because your background
    // will, after capturing, send us a scrollNext message to continue)

    // Give page time to paint, lazy-load, reflow
    setTimeout(async () => {
      if (!isCapturing) return;
      console.log("accurate scroll count:", noOfScrolls);
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
        restoreHeaders();
        showSidebar();
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
      console.log("[content] capture requested to background");
    }, 800); // adjust if page lazy-loads slower or faster
  }

  chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
    // Start capture sequence (initial top capture)
    if (msg.action === "startCapturing") {
      // initialize
      isCapturing = true;
      viewportHeight = window.innerHeight;
      scrollY = 0;
      lastCapturedScrollY = null;
      scrollCount = 0;

      // immediately perform initial scroll+capture (scroll to top then capture)
      scrollAndRequestCapture(scrollCount);

      sendResponse({ status: "started" });
      return true;
    }

    // Background will send this after it captures visible tab (see your background.ts).
    // When the content script receives the very first "scrollNext", hide the sidebar before
    // performing the next scroll+capture so subsequent captures do not include the sidebar.
    if (msg.action === "scrollNext") {
      console.log("[content] received scrollNext from background");
      if (!isCapturing) {
        sendResponse({ status: "not-capturing" });
        return true;
      }

      if (scrollCount >= maxScrolls) {
        isCapturing = false;
        chrome.runtime.sendMessage({ action: "CapturingComplete" });
        restoreHeaders();
        showSidebar();
        sendResponse({ status: "done" });
        return;
      }

      // If this is the first scrollNext (meaning first capture finished), hide the sidebar
      // before performing the next scroll+capture.

      // recompute based on the *current* visible position so we don't fight user's manual scroll
      viewportHeight = window.innerHeight;

      // compute next target and clamp to available scroll range
      const nextTarget = clampScrollY(window.scrollY + viewportHeight);
      scrollY = nextTarget;

      // increment BEFORE calling scrollAndRequestCapture so the function receives correct index
      console.log("before increment scrollCount:", scrollCount);
      scrollCount++;
      scrollAndRequestCapture(scrollCount);
      console.log("no of scrolls:", scrollCount);

      sendResponse({ status: "scrolled", scrollY });
      return true;
    }

    // Combine images handler (unchanged logic)
    if (msg.action === "combine") {
      const images: string[] = msg.images;
      console.log("images received", msg.images);
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
            console.log("trim top", trimTop);
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
