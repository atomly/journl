"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useAppLayout } from "~/app/_components/app-layout-provider";
import { useExploreState } from "./explore-state";

/** Restore the app's scroll container after async route content has its final height. */
export function ExplorePageScroll({ children }: { children: React.ReactNode }) {
  const { scrollElement } = useAppLayout();
  const pathname = usePathname();
  const params = useSearchParams();
  const route = `${pathname}?${params.toString()}`;
  const [scroll, setScroll] = useExploreState(`page:${route}`, 0);
  const content = useRef<HTMLDivElement>(null);
  const position = useRef(scroll);
  position.current = scroll;
  const restoring = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: route changes start a new restoration lifecycle; saved scroll updates must not restart it.
  useEffect(() => {
    if (!scrollElement) return;
    restoring.current = true;
    const restore = () => {
      if (restoring.current) scrollElement.scrollTop = position.current;
    };
    const interact = () => {
      restoring.current = false;
    };
    const save = () => {
      if (!restoring.current) setScroll(scrollElement.scrollTop);
    };
    restore();
    const observer = new ResizeObserver(restore);
    if (content.current) observer.observe(content.current);
    scrollElement.addEventListener("wheel", interact, { passive: true });
    scrollElement.addEventListener("pointerdown", interact, { passive: true });
    scrollElement.addEventListener("keydown", interact);
    scrollElement.addEventListener("scroll", save, { passive: true });
    return () => {
      observer.disconnect();
      scrollElement.removeEventListener("wheel", interact);
      scrollElement.removeEventListener("pointerdown", interact);
      scrollElement.removeEventListener("keydown", interact);
      scrollElement.removeEventListener("scroll", save);
    };
  }, [scrollElement, route, setScroll]);
  useEffect(() => {
    if (restoring.current && scrollElement) scrollElement.scrollTop = scroll;
  }, [scroll, scrollElement]);
  return <div ref={content}>{children}</div>;
}
