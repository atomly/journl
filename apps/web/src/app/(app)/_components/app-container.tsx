"use client";

import { useCallback, useEffect, useRef } from "react";
import { useIsMobile } from "~/hooks/use-mobile";
import { useAppLayout } from "../../_components/app-layout-provider";

type AppContainerProps = React.ComponentProps<"div">;

const VISUAL_VIEWPORT_OFFSET_TOP_VAR = "--app-visual-viewport-offset-top";

function setVisualViewportOffsetTop(value: number) {
  document.documentElement.style.setProperty(
    VISUAL_VIEWPORT_OFFSET_TOP_VAR,
    `${value}px`,
  );
}

function clearVisualViewportOffsetTop() {
  document.documentElement.style.removeProperty(VISUAL_VIEWPORT_OFFSET_TOP_VAR);
}

export function AppContainer({ children, ...props }: AppContainerProps) {
  const { setScrollElement } = useAppLayout();
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      setScrollElement(node);
    },
    [setScrollElement],
  );

  useEffect(() => {
    return () => {
      setScrollElement(null);
    };
  }, [setScrollElement]);

  useEffect(() => {
    if (!isMobile) {
      clearVisualViewportOffsetTop();
      return;
    }

    const viewport = window.visualViewport;
    const container = containerRef.current;

    if (!viewport || !container) {
      clearVisualViewportOffsetTop();
      return;
    }

    const syncVisualViewportOffset = () => {
      const containerTop = container.getBoundingClientRect().top;
      const nextOffsetTop = -containerTop;

      setVisualViewportOffsetTop(
        Number.isFinite(nextOffsetTop) ? Math.max(0, nextOffsetTop) : 0,
      );
    };

    let animationFrameId: number | null = null;

    const scheduleSyncVisualViewportOffset = () => {
      if (animationFrameId !== null) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null;
        syncVisualViewportOffset();
      });
    };

    const flushSyncVisualViewportOffset = () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      syncVisualViewportOffset();
    };

    const handleOrientationChange = () => {
      flushSyncVisualViewportOffset();
    };

    flushSyncVisualViewportOffset();

    viewport.addEventListener("resize", scheduleSyncVisualViewportOffset);
    viewport.addEventListener("scroll", scheduleSyncVisualViewportOffset);
    viewport.addEventListener("scrollend", flushSyncVisualViewportOffset);
    container.addEventListener("scroll", scheduleSyncVisualViewportOffset, {
      passive: true,
    });
    window.addEventListener("resize", scheduleSyncVisualViewportOffset);
    window.addEventListener("orientationchange", handleOrientationChange);

    return () => {
      viewport.removeEventListener("resize", scheduleSyncVisualViewportOffset);
      viewport.removeEventListener("scroll", scheduleSyncVisualViewportOffset);
      viewport.removeEventListener("scrollend", flushSyncVisualViewportOffset);
      container.removeEventListener("scroll", scheduleSyncVisualViewportOffset);
      window.removeEventListener("resize", scheduleSyncVisualViewportOffset);
      window.removeEventListener("orientationchange", handleOrientationChange);

      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      clearVisualViewportOffsetTop();
    };
  }, [isMobile]);

  return (
    <div ref={handleRef} {...props}>
      {children}
    </div>
  );
}
