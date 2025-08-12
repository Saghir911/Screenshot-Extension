import React from "react";

const Popup = () => {
  async function takeSnip() {
    chrome.runtime.sendMessage({ action: "takeScreenshot" });
  }
  return (
    <>
      <button onClick={takeSnip}>Take Snip</button>
    </>
  );
};

export default Popup;
