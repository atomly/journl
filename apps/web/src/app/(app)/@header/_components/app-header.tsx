"use client";

import { cn } from "@acme/ui/utils";
import { useEffect, useState } from "react";
import { useIsMobile } from "~/components/ui/use-shell-viewport";
import { useAppLayout } from "../../../_components/app-layout-provider";

type AppHeaderProps = React.ComponentProps<"header">;

const SHOW_AT_SCROLL_TOP = 12;
const HIDE_SCROLL_DELTA = SHOW_AT_SCROLL_TOP * 2;
const SHOW_SCROLL_DELTA = SHOW_AT_SCROLL_TOP * 6;

export function AppHeader({ className, ...props }: AppHeaderProps) {
  const isMobile = useIsMobile();
  const { scrollElement } = useAppLayout();
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    if (!isMobile) {
      setIsHidden(false);
      return;
    }

    const getScrollTop = () => {
      const element = scrollElement ?? document.documentElement;
      const scrollTop = scrollElement
        ? scrollElement.scrollTop
        : window.scrollY;

      // Ignore elastic overscroll at either edge of the scroll container.
      return Math.max(
        0,
        Math.min(scrollTop, element.scrollHeight - element.clientHeight),
      );
    };

    let lastScrollY = getScrollTop();
    let directionDistance = 0;
    let animationFrameId: number | null = null;
    setIsHidden(false);

    const updateVisibility = () => {
      const currentScrollY = getScrollTop();
      const delta = currentScrollY - lastScrollY;
      lastScrollY = currentScrollY;

      if (currentScrollY <= SHOW_AT_SCROLL_TOP) {
        directionDistance = 0;
        setIsHidden(false);
        return;
      }

      if (delta === 0) {
        return;
      }

      // Measure a gesture's distance, not its speed in a single frame.
      directionDistance =
        Math.sign(delta) === Math.sign(directionDistance)
          ? directionDistance + delta
          : delta;

      if (directionDistance >= HIDE_SCROLL_DELTA) {
        setIsHidden(true);
      } else if (directionDistance <= -SHOW_SCROLL_DELTA) {
        setIsHidden(false);
      }
    };

    const onScroll = () => {
      if (animationFrameId !== null) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null;
        updateVisibility();
      });
    };

    const listenerTarget = scrollElement ?? window;
    listenerTarget.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      listenerTarget.removeEventListener("scroll", onScroll);
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isMobile, scrollElement]);

  // Client navigation retains pointer focus; only keyboard focus should keep
  // the header visible while the content scrolls.
  return (
    <header
      data-hidden={isHidden}
      className={cn(
        "peer/app-header fixed top-0 right-0 left-0 z-2 mx-3 mt-3 h-16 transform-gpu transition-transform duration-300 ease-out will-change-transform has-[:focus-visible]:translate-y-0 motion-reduce:transition-none min-[701px]:sticky min-[701px]:top-0 min-[701px]:right-auto min-[701px]:left-auto min-[701px]:m-0 min-[701px]:h-16",
        {
          "-translate-y-[calc(100%+2rem)] min-[701px]:translate-y-0": isHidden,
        },
        className,
      )}
      {...props}
    />
  );
}
