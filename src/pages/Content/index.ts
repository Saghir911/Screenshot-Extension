chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "convert") {
    // Display the image on the page
    if (msg.dataURI) {
      const img = document.createElement("img");
      img.src = msg.dataURI;
      img.style.maxWidth = "300px";
      img.style.border = "2px solid #333";
      img.style.display = "block";
      img.style.margin = "16px auto";
      document.body.appendChild(img);
      
      const blob = dataURItoBlob(msg.dataURI);
      console.log("image:", blob);
    }
    sendResponse({ status: 'done' });
  }
  return true;
});

// Convert base64 dataURL to Blob
function dataURItoBlob(dataURI: string): Blob {
  const byteString = atob(dataURI.split(",")[1]);
  const mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}
