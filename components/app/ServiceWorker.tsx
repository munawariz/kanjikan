"use client";

import { useEffect } from "react";

/**
 * Registers the service worker, which is what makes the app installable.
 *
 * Registration is deferred to the load event: it is not needed for first
 * paint, and competing with the initial page for bandwidth would make the
 * first visit slower to gain nothing.
 *
 * Skipped in development, where a stale worker serving old build assets is a
 * confusing way to lose an afternoon.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((e) => {
        console.error("[kanjikan] service worker registration failed", e);
      });
    };

    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
