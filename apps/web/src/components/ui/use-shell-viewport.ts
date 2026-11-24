"use client";
import { useSyncExternalStore } from "react";

function subscribe(listener: () => void) {
  const query = window.matchMedia("(max-width: 1100px)");
  const mobile = window.matchMedia("(max-width: 700px)");
  query.addEventListener("change", listener);
  mobile.addEventListener("change", listener);
  return () => {
    query.removeEventListener("change", listener);
    mobile.removeEventListener("change", listener);
  };
}
export function useShellViewport() {
  const width = useSyncExternalStore(
    subscribe,
    () =>
      window.matchMedia("(max-width: 700px)").matches
        ? "mobile"
        : window.matchMedia("(max-width: 1100px)").matches
          ? "tablet"
          : "desktop",
    () => "desktop",
  );
  return width;
}
export function useIsMobile() {
  return useShellViewport() === "mobile";
}

const subscribeReady = () => () => {};
/** Wait for the viewport snapshot before enabling controls whose primitive changes on mobile. */
export function useShellReady() {
  return useSyncExternalStore(
    subscribeReady,
    () => true,
    () => false,
  );
}
