import React, { useEffect, useState } from "react";
import "./Result.css";

export const Result: React.FC = () => {
  const [url, setUrl] = useState("");

  useEffect(() => {
    chrome.runtime.sendMessage({ action: "getUrl" }, (res) => {
      if (chrome.runtime.lastError) {
        console.warn("lastError:", chrome.runtime.lastError.message);
        return;
      }
      const url = res?.url ?? null;
      if (url) setUrl(url);
      else console.log("no url yet");
    });
  }, []);
  return (
    <div className="result-container">
      <h1>Screenshot Captured</h1>
      <div className="image-container">
        {url && <img className="screenshot-image" src={url} alt="Screenshot" />}
      </div>
    </div>
  );
};
