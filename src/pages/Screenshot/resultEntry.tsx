import React from "react";
import ReactDOM from "react-dom";
import { Result } from "./Result";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "sendUrls") {
    sendResponse({status:"sending complete"})
    console.log("message name is:", msg.action);
    console.log("data of urls:", msg.urls);
    ReactDOM.render(
      <Result imageUrl={msg.urls || ""} />,
      document.getElementById("root")
    );
  }
});
