import React from "react";
import "./Popup.css"; // Assuming you have a CSS file for styling

const Popup: React.FC = () => {
  const takeScreenshot = async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab.id) {
      await chrome.tabs.sendMessage(tab.id, { action: "startCapturing" });
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
