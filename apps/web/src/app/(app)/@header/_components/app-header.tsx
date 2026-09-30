"use client";

import { useEffect, useState } from "react";
import { useIsMobile } from "~/hooks/use-mobile";
import { cn } from "~/lib/cn";
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

  return (
    <header
      data-hidden={isHidden}
      className={cn(
        "peer/app-header fixed top-0 right-0 left-0 z-4500 mx-6 mt-2 h-12 transform-gpu transition-transform duration-300 ease-out will-change-transform focus-within:translate-y-0 motion-reduce:transition-none md:sticky md:top-0 md:right-auto md:left-auto md:m-2",
        {
          "-translate-y-[calc(100%+2rem)] md:translate-y-0": isHidden,
        },
        className,
      )}
      {...props}
    />
  );
}
