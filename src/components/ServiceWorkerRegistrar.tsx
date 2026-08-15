"use client";

import { useEffect } from "react";

// Registers the service worker that makes the app installable to a phone's
// home screen. See public/sw.js — it caches only immutable build assets, never
// pages or API responses, so installing can't surface stale financial figures.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Only meaningful over HTTPS (or localhost); browsers ignore it otherwise.
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failing just means no home-screen install — the app
      // itself works normally, so there's nothing to surface to the user.
    });
  }, []);

  return null;
}
