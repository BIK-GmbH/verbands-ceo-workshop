import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Hide splash once React has mounted. Min visible time keeps it from flashing
// on fast loads. Honour reduced-motion (skip transition) and motion=off setting.
function hideSplash() {
  const el = document.getElementById("splash");
  if (!el) return;
  const motionOff =
    document.documentElement.dataset.motion === "off" ||
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (motionOff) {
    el.remove();
    return;
  }
  el.dataset.leaving = "1";
  el.addEventListener("transitionend", () => el.remove(), { once: true });
  // Safety net: remove after 800ms even if transitionend never fires
  setTimeout(() => el.parentNode && el.remove(), 800);
}

requestAnimationFrame(() => {
  // Wait at least 1500ms so the BIK logo can breathe + the brand registers.
  const startedAt = Number(window.__splashStart ?? performance.now());
  const elapsed = performance.now() - startedAt;
  const wait = Math.max(0, 1500 - elapsed);
  setTimeout(hideSplash, wait);
});

declare global {
  interface Window {
    __splashStart?: number;
  }
}
