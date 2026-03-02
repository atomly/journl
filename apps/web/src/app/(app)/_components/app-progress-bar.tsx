"use client";

import { usePathname, useSearchParams } from "next/navigation";
import React from "react";
import { Progress } from "~/components/ui/progress";

const START_PROGRESS_INTERVAL_MS = 120;
const END_PROGRESS_TIMEOUT_MS = START_PROGRESS_INTERVAL_MS * 3;
const END_PROGRESS_MIN_TIMEOUT_MS = START_PROGRESS_INTERVAL_MS * 5;

type ApplicationProgressProps = Omit<
  React.ComponentProps<typeof Progress>,
  "value"
>;

export function AppProgressBar({ ...props }: ApplicationProgressProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [progress, setProgress] = React.useState(0);

  const startTimeRef = React.useRef<number | null>(null);
  const progressIntervalRef = React.useRef<number | null>(null);
  const completionTimeoutRef = React.useRef<number | null>(null);

  const navKey = React.useMemo(
    () => buildNavKey(pathname, searchParams),
    [pathname, searchParams],
  );

  const prevNavKeyRef = React.useRef(navKey);

  const clearTimers = React.useEffectEvent(() => {
    if (progressIntervalRef.current) {
      window.clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (completionTimeoutRef.current) {
      window.clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }
  });

  const isIdle = React.useEffectEvent(() => {
    return progress === 0 || progress >= 100;
  });

  const startProgress = React.useEffectEvent(() => {
    clearTimers();
    if (startTimeRef.current === null) {
      startTimeRef.current = performance.now();
    }
    progressIntervalRef.current = window.setInterval(() => {
      setProgress((prev) => {
        const ceiling = 92;
        const rate = prev < 50 ? 0.18 : 0.06;
        const next = prev + (ceiling - prev) * rate;
        return Math.min(next, ceiling);
      });
    }, START_PROGRESS_INTERVAL_MS);
  });

  const resetProgress = React.useEffectEvent(() => {
    clearTimers();
    startTimeRef.current = null;
    setProgress(0);
  });

  const endProgress = React.useEffectEvent(() => {
    const startedAt = startTimeRef.current ?? performance.now();
    const elapsed = performance.now() - startedAt;
    const remaining = Math.max(0, END_PROGRESS_MIN_TIMEOUT_MS - elapsed);

    completionTimeoutRef.current = window.setTimeout(() => {
      clearTimers();
      setProgress(99.99999);
      completionTimeoutRef.current = window.setTimeout(() => {
        setProgress(100);
        startTimeRef.current = null;
      }, END_PROGRESS_TIMEOUT_MS);
    }, remaining);
  });

  React.useEffect(() => {
    const prev = prevNavKeyRef.current;
    if (navKey === prev) return;

    // If the bar isn't running, we still want a quick "pop" to indicate nav.
    if (isIdle()) resetProgress();
    startProgress();

    const timeoutId = window.setTimeout(() => {
      endProgress();
    }, 0);

    prevNavKeyRef.current = navKey;

    return () => window.clearTimeout(timeoutId);
  }, [navKey]);

  React.useEffect(() => clearTimers, []);

  const shouldShowProgress = progress > 0 && progress < 100;
  if (!shouldShowProgress) return null;

  return <Progress value={progress} {...props} />;
}

function buildNavKey(pathname: string, searchParams: URLSearchParams | null) {
  const qs = searchParams ? searchParams.toString() : "";
  return qs ? `${pathname}?${qs}` : pathname;
}
