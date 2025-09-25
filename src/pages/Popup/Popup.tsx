import React, { useState, useEffect } from "react";
import "./Popup.css";

const Popup: React.FC = () => {
  // const [disableButton, setDisableButton] = useState(false);
const takeScreenshot = async () => {
  try {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (typeof tabId === "number") {
        chrome.tabs.sendMessage(tabId, { action: "beginCapture" }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("Message error:", chrome.runtime.lastError.message);
          } else {
            console.log("Response from content script:", response);
          }
        });
      } else {
        console.error("No valid tab.id found");
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
      <button className="screenshot-button" onClick={takeScreenshot}>
        Take Screenshot
      </button>
    </div>
  );
};

export default Popup;
