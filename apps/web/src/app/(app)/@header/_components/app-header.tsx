"use client";

import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "~/hooks/use-mobile";
import { cn } from "~/lib/cn";
import { useAppLayout } from "../../../_components/app-layout-provider";

type StickyHeaderProps = React.ComponentProps<"header">;

const SHOW_AT_SCROLL_TOP = 12;
const HIDE_SCROLL_DELTA = SHOW_AT_SCROLL_TOP * 2;
const SHOW_SCROLL_DELTA = SHOW_AT_SCROLL_TOP * 6;

export function AppHeader({ className, ...props }: StickyHeaderProps) {
  const isMobile = useIsMobile();
  const { scrollElement } = useAppLayout();
  const [isHidden, setIsHidden] = useState(false);
  const lastScrollYRef = useRef(0);
  const tickingRef = useRef(false);

  useEffect(() => {
    if (!isMobile) {
      setIsHidden(false);
      return;
    }

    const getScrollTop = () => {
      return scrollElement
        ? scrollElement.scrollTop
        : Math.max(window.scrollY, document.documentElement.scrollTop, 0);
    };

    const updateVisibility = () => {
      const currentScrollY = getScrollTop();
      const delta = currentScrollY - lastScrollYRef.current;
      lastScrollYRef.current = currentScrollY;

      if (currentScrollY <= SHOW_AT_SCROLL_TOP) {
        setIsHidden(false);
        return;
      }

      if (delta > 0 && delta < HIDE_SCROLL_DELTA) {
        return;
      }

      if (delta < 0 && Math.abs(delta) < SHOW_SCROLL_DELTA) {
        return;
      }

      if (delta > 0) {
        setIsHidden(true);
      }

      if (delta < 0) {
        setIsHidden(false);
      }

      lastScrollYRef.current = currentScrollY;
    };

    const onScroll = () => {
      if (tickingRef.current) {
        return;
      }

      tickingRef.current = true;
      window.requestAnimationFrame(() => {
        updateVisibility();
        tickingRef.current = false;
      });
    };

    const listenerTarget = scrollElement ?? window;
    listenerTarget.addEventListener("scroll", onScroll, { passive: true });

    lastScrollYRef.current = getScrollTop();

    return () => {
      listenerTarget.removeEventListener("scroll", onScroll);
    };
  }, [isMobile, scrollElement]);

  return (
    <>
      <div
        aria-hidden
        className={cn(
          "shrink-0 overflow-hidden transition-[height] duration-200 ease-out md:hidden",
          isHidden ? "h-0" : "h-14",
        )}
      />
      <header
        className={cn(
          "fixed top-0 right-0 left-0 z-4500 mx-6 mt-2 h-12 transform-gpu transition-transform duration-200 ease-out will-change-transform md:sticky md:top-0 md:right-auto md:left-auto md:m-2",
          {
            "-translate-y-[calc(100%+2rem)] md:translate-y-0": isHidden,
          },
          className,
        )}
        {...props}
      />
    </>
  );
}
