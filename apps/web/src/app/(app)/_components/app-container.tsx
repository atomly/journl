"use client";

import { useCallback, useEffect } from "react";
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

  const handleRef = useCallback(
    (node: HTMLDivElement | null) => {
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

    if (!viewport) {
      clearVisualViewportOffsetTop();
      return;
    }

    const syncVisualViewportOffset = () => {
      setVisualViewportOffsetTop(Math.max(0, viewport.offsetTop));
    };

    syncVisualViewportOffset();

    viewport.addEventListener("resize", syncVisualViewportOffset);
    viewport.addEventListener("scroll", syncVisualViewportOffset);
    window.addEventListener("orientationchange", syncVisualViewportOffset);

    return () => {
      viewport.removeEventListener("resize", syncVisualViewportOffset);
      viewport.removeEventListener("scroll", syncVisualViewportOffset);
      window.removeEventListener("orientationchange", syncVisualViewportOffset);
      clearVisualViewportOffsetTop();
    };
  }, [isMobile]);

  return (
    <div ref={handleRef} {...props}>
      {children}
    </div>
  );
}
