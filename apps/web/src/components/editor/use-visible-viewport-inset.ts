"use client";

import { useEffect, useState } from "react";

/** Reserve space when a software keyboard shrinks only the visual viewport. */
export function useVisibleViewportInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let frame: number | undefined;
    const sync = () => {
      frame = undefined;
      // Leave pinch zoom under the user's control; it is not keyboard occlusion.
      setInset(
        viewport.scale === 1
          ? Math.max(
              0,
              window.innerHeight - viewport.height - viewport.offsetTop,
            )
          : 0,
      );
    };
    const schedule = () => {
      if (frame === undefined) frame = requestAnimationFrame(sync);
    };
    sync();
    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);
  return inset;
}
