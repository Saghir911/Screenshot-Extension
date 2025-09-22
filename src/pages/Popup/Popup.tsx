import React, { useState, useEffect } from "react";
import "./Popup.css";

const Popup: React.FC = () => {
  const [disableButton, setDisableButton] = useState(false);
  const takeScreenshot = async () => {
    try {
      // const tabs = await chrome.tabs.query({
      //   active: true,
      //   currentWindow: true,
      // });
      // const tab = tabs[0];
      // if (!tab?.id) {
      //   console.error("No active tab found");
      //   return;
      // }

      // Tell background to begin capture for this tab. Background will inject content script if needed.
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, { action: "beginCapture" });
        } else {
          console.error("No active tab found");
        }
      });
      return true;
    } catch (err) {
      console.error("takeScreenshot error:", err);
    }
  };

  // useEffect(() => {
  //   const messageListener = (msg: any, sender: any, sendResponse: any) => {
  //     if (msg.action === "startCapturing") {
  //       console.log(msg.action);
  //       setDisableButton(true);
  //     } else if (msg.action === "capturingComplete") {
  //       setDisableButton(false);
  //     }
  //   };

  //   chrome.runtime.onMessage.addListener(messageListener);

  //   // Cleanup listener on component unmount
  //   return () => {
  //     chrome.runtime.onMessage.removeListener(messageListener);
  //   };
  // }, []);
  return (
    <div className="main">
      <button
        disabled={disableButton}
        className="screenshot-button"
        onClick={takeScreenshot}
      >
        {disableButton ? "Capturing..." : "Take Screenshot"}
      </button>
    </div>
  );
};

export default Popup;
