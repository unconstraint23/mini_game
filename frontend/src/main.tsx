import React from "react";
import ReactDOM from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import "./styles/index.css";
import App from "./App";

// Register offline PWA Service Worker on hosted HTTPS web (e.g., GitHub Pages)
if (
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  window.location.protocol === "https:" &&
  !Capacitor.isNativePlatform() &&
  !window.neuropulse?.isDesktop
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // ignore SW registration failure
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
