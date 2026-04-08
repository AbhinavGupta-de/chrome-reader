if (typeof pdfjsLib !== "undefined" && typeof chrome !== "undefined" && chrome.runtime) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf.worker.min.js");
}
