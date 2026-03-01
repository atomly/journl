"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const AUTO_COMPLETE_AFTER_MS = 4000;
const HIDE_AFTER_MS = 180;
const INITIAL_PROGRESS = 10;
const MAX_PROGRESS = 92;
const TICK_INTERVAL_MS = 140;

function isModifiedEvent(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function getPathWithSearch(url: URL) {
  return `${url.pathname}${url.search}`;
}

export function PageLoadProgressBar() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  const isNavigatingRef = useRef(false);
  const progressTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const autoCompleteTimerRef = useRef<number | null>(null);
  const lastPathnameRef = useRef(pathname);

  const finishProgress = useCallback(() => {
    if (!isNavigatingRef.current) {
      return;
    }

    isNavigatingRef.current = false;

    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    if (autoCompleteTimerRef.current !== null) {
      window.clearTimeout(autoCompleteTimerRef.current);
      autoCompleteTimerRef.current = null;
    }

    setProgress(100);

    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
    }

    hideTimerRef.current = window.setTimeout(() => {
      setIsVisible(false);
      setProgress(0);
      hideTimerRef.current = null;
    }, HIDE_AFTER_MS);
  }, []);

  const startProgress = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (!isNavigatingRef.current) {
      isNavigatingRef.current = true;
      setIsVisible(true);
      setProgress(INITIAL_PROGRESS);
    }

    if (progressTimerRef.current === null) {
      progressTimerRef.current = window.setInterval(() => {
        setProgress((value) => {
          if (value >= MAX_PROGRESS) {
            return value;
          }

          const remaining = MAX_PROGRESS - value;
          const increment = remaining > 30 ? 7 : remaining > 15 ? 4 : 1.2;

          return Math.min(MAX_PROGRESS, value + increment);
        });
      }, TICK_INTERVAL_MS);
    }

    if (autoCompleteTimerRef.current !== null) {
      window.clearTimeout(autoCompleteTimerRef.current);
    }

    autoCompleteTimerRef.current = window.setTimeout(() => {
      finishProgress();
    }, AUTO_COMPLETE_AFTER_MS);
  }, [finishProgress]);

  useEffect(() => {
    if (lastPathnameRef.current === pathname) {
      return;
    }

    lastPathnameRef.current = pathname;
    finishProgress();
  }, [pathname, finishProgress]);

  useEffect(() => {
    const currentPath = () =>
      `${window.location.pathname}${window.location.search}`;

    const getUrl = (url: string | URL) => {
      try {
        return new URL(url.toString(), window.location.href);
      } catch {
        return null;
      }
    };

    const shouldTrackAnchor = (anchor: HTMLAnchorElement) => {
      const href = anchor.getAttribute("href");

      if (!href || href.startsWith("#")) {
        return false;
      }

      if (anchor.target && anchor.target !== "_self") {
        return false;
      }

      if (
        anchor.hasAttribute("download") ||
        anchor.dataset.progress === "false"
      ) {
        return false;
      }

      const rel = anchor.getAttribute("rel");

      if (rel?.split(/\s+/).includes("external")) {
        return false;
      }

      const nextUrl = getUrl(anchor.href);

      if (!nextUrl || nextUrl.origin !== window.location.origin) {
        return false;
      }

      return getPathWithSearch(nextUrl) !== currentPath();
    };

    const maybeTrackUrl = (next: string | URL | null | undefined) => {
      if (!next) {
        return;
      }

      const nextUrl = getUrl(next);

      if (!nextUrl || nextUrl.origin !== window.location.origin) {
        return;
      }

      if (getPathWithSearch(nextUrl) !== currentPath()) {
        startProgress();
      }
    };

    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        isModifiedEvent(event)
      ) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a");

      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (shouldTrackAnchor(anchor)) {
        startProgress();
      }
    };

    const handlePopState = () => {
      startProgress();
    };

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function pushState(
      ...args: Parameters<History["pushState"]>
    ) {
      maybeTrackUrl(args[2]);

      return originalPushState.apply(window.history, args);
    };

    window.history.replaceState = function replaceState(
      ...args: Parameters<History["replaceState"]>
    ) {
      maybeTrackUrl(args[2]);

      return originalReplaceState.apply(window.history, args);
    };

    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;

      if (progressTimerRef.current !== null) {
        window.clearInterval(progressTimerRef.current);
      }

      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }

      if (autoCompleteTimerRef.current !== null) {
        window.clearTimeout(autoCompleteTimerRef.current);
      }
    };
  }, [startProgress]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999]"
    >
      <div
        className="h-[3px] bg-primary shadow-[0_0_10px_var(--color-primary)] transition-[width,opacity] duration-200 ease-out"
        style={{
          opacity: isVisible ? 1 : 0,
          width: `${progress}%`,
        }}
      />
    </div>
  );
}
