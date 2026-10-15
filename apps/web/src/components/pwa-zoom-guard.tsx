"use client";

import { useEffect } from "react";

/** Safari's standalone gestures can bypass the document's touch-action rule. */
export function PwaZoomGuard() {
  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && navigator.standalone === true);
    if (!standalone) return;

    const preventZoom = (event: Event) => event.preventDefault();
    const preventPinch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    const options = { capture: true, passive: false };

    document.documentElement.setAttribute("data-pwa-standalone", "");
    document.addEventListener("gesturestart", preventZoom, options);
    document.addEventListener("gesturechange", preventZoom, options);
    document.addEventListener("touchmove", preventPinch, options);

    return () => {
      document.documentElement.removeAttribute("data-pwa-standalone");
      document.removeEventListener("gesturestart", preventZoom, options);
      document.removeEventListener("gesturechange", preventZoom, options);
      document.removeEventListener("touchmove", preventPinch, options);
    };
  }, []);

  return null;
}
