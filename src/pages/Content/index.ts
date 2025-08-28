// content-script.js
(async () => {
  console.log("I am above console");
  let scrollY = 0;
  let viewportHeight = window.innerHeight;

  function clampScrollY(y: any) {
    const maxScroll =
      Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      ) - viewportHeight;
    return Math.min(y, Math.max(0, maxScroll));
  }

  function scrollAndCapture() {
    const totalHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    );
    const maxScroll = Math.max(0, totalHeight - viewportHeight);

    console.log(
      "[capture] scrollY:",
      scrollY,
      "viewport:",
      viewportHeight,
      "totalHeight:",
      totalHeight,
      "maxScroll:",
      maxScroll
    );

    if (scrollY <= maxScroll) {
      // instant jump to avoid smooth scroll timing problems
      window.scrollTo(0, scrollY);
      // give the page time to paint and lazy-load images
      setTimeout(() => {
        chrome.runtime.sendMessage({ action: "capture" });
      }, 800); // raise if needed (1000ms)
    } else {
      chrome.runtime.sendMessage({ action: "done" });
      console.log("✅ Finished capturing full page");
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "startCapturing") {
      console.log("I am start caputering console");
      sendResponse("done")
      scrollY = 0;
      viewportHeight = window.innerHeight;
      window.scrollTo(0, 0);
      setTimeout(() => {
        chrome.runtime.sendMessage({ action: "capture" });
      }, 800);
    }

    if (msg.action === "scrollNext") {
      console.log("I am scroll next console");
      sendResponse("done")
      viewportHeight = window.innerHeight;
      scrollY = clampScrollY(scrollY + viewportHeight);
      scrollAndCapture();
    }
  });
})();
