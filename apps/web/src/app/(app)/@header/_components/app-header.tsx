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

    const getScrollTop = (element: HTMLElement) => {
      // Ignore elastic overscroll at either edge of the scroll container.
      return Math.max(
        0,
        Math.min(
          element.scrollTop,
          element.scrollHeight - element.clientHeight,
        ),
      );
    };

    const initialScrollTarget = scrollElement ?? document.scrollingElement;
    let lastScrollTarget: HTMLElement =
      initialScrollTarget instanceof HTMLElement
        ? initialScrollTarget
        : document.documentElement;
    let lastScrollY = getScrollTop(lastScrollTarget);
    let directionDistance = 0;
    let animationFrameId: number | null = null;
    let pendingScrollTarget: HTMLElement | null = null;
    setIsHidden(false);

    const updateVisibility = (target: HTMLElement) => {
      const currentScrollY = getScrollTop(target);

      // Virtualized pages can use a descendant as their scroll container.
      // Start a fresh direction measurement when the active scroller changes.
      if (target !== lastScrollTarget) {
        lastScrollTarget = target;
        lastScrollY = currentScrollY;
        directionDistance = 0;
        if (currentScrollY <= SHOW_AT_SCROLL_TOP) {
          setIsHidden(false);
        }
        return;
      }

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

    const onScroll = (event: Event) => {
      const target =
        event.target instanceof HTMLElement
          ? event.target
          : document.scrollingElement;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (
        scrollElement &&
        target !== scrollElement &&
        !scrollElement.contains(target) &&
        target !== document.documentElement &&
        target !== document.body
      ) {
        return;
      }

      pendingScrollTarget = target;
      if (animationFrameId !== null) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null;
        const targetToUpdate = pendingScrollTarget;
        pendingScrollTarget = null;
        if (targetToUpdate) {
          updateVisibility(targetToUpdate);
        }
      });
    };

    window.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", onScroll, true);
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
