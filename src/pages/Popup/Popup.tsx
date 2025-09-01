import React from "react";
import "./Popup.css";

const Popup: React.FC = () => {
  const takeScreenshot = async () => {
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const tab = tabs[0];
      if (!tab?.id) {
        console.error("No active tab found");
        return;
      }

      // Tell background to begin capture for this tab. Background will inject content script if needed.
      chrome.runtime.sendMessage(
        { action: "beginCapture", tabId: tab.id },
        (res) => {
          if (chrome.runtime.lastError) {
            console.error(
              "beginCapture error:",
              chrome.runtime.lastError.message
            );
          } else {
            console.log("beginCapture response:", res);
          }
        }
      );
    } catch (err) {
      console.error("takeScreenshot error:", err);
    }
  };

  return (
    <div className="main">
      <button className="screenshot-button" onClick={takeScreenshot}>
        Take Screenshot
      </button>
    </div>
  );
};

export default Popup;
