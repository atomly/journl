"use client";

import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "~/hooks/use-mobile";
import { cn } from "~/lib/cn";
import { useAppLayout } from "../../../_components/app-layout-provider";

type StickyHeaderProps = React.ComponentProps<"header">;

const SHOW_AT_SCROLL_TOP = 12;
const MIN_SCROLL_DELTA = SHOW_AT_SCROLL_TOP * 3;

export function FixedHeader({ className, ...props }: StickyHeaderProps) {
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

      if (Math.abs(delta) < MIN_SCROLL_DELTA) {
        return;
      }

      if (currentScrollY <= SHOW_AT_SCROLL_TOP) {
        setIsHidden(false);
        lastScrollYRef.current = currentScrollY;
        return;
      }

      if (delta > MIN_SCROLL_DELTA) {
        setIsHidden(true);
      }

      if (delta < -MIN_SCROLL_DELTA) {
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
    <header
      className={cn(
        "z-4500 mx-6 mt-2 h-12 md:m-2",
        {
          "-translate-y-[calc(100%+2rem)]": isMobile && isHidden,
          "fixed top-0 right-0 left-0 transform-gpu transition-transform duration-200 ease-out will-change-transform":
            isMobile,
          "sticky top-0": !isMobile,
          "translate-y-0": isMobile && !isHidden,
        },
        className,
      )}
      {...props}
    />
  );
}
