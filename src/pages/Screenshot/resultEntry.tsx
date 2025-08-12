import React from "react";
import ReactDOM from "react-dom";
import { Result } from "./Result";

chrome.storage.local.get("screenshotUrl", (data) => {
  ReactDOM.render(
    <Result imageUrl={data.screenshotUrl || ""} />,
    document.getElementById("root")
  );
});
