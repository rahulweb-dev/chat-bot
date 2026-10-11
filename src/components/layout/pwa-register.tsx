"use client";
import { useEffect } from "react";

// Registers the service worker so the dashboard can be installed as an app and
// receive push notifications. Renders nothing.
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => { /* unsupported / blocked: app still works */ });
    }
  }, []);
  return null;
}
