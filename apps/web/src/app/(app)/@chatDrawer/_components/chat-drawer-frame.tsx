"use client";
import { DrawerContent } from "@acme/ui/drawer";
import { useEffect, useState } from "react";

/** Keep the app sheet inside the visible viewport while the keyboard is open. */
export function ChatDrawerFrame({ children }: { children: React.ReactNode }) {
  const [viewport, setViewport] = useState<{
    height: number;
    bottom: number;
  }>();
  useEffect(() => {
    const visual = window.visualViewport;
    if (!visual) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setViewport({
          bottom: Math.max(
            0,
            window.innerHeight - visual.height - visual.offsetTop,
          ),
          height: visual.height,
        }),
      );
    };
    update();
    visual.addEventListener("resize", update);
    visual.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      visual.removeEventListener("resize", update);
      visual.removeEventListener("scroll", update);
    };
  }, []);
  return (
    <DrawerContent
      id="chat-drawer-content"
      className="journl-agent-sheet inset-x-0! overflow-hidden rounded-t-[18px] rounded-b-none border border-border bg-sidebar pb-[env(safe-area-inset-bottom,0px)] motion-reduce:transition-none"
      style={
        viewport
          ? ({
              "--sheet-bottom": `${viewport.bottom}px`,
              "--sheet-visible-height": `${viewport.height}px`,
            } as React.CSSProperties)
          : undefined
      }
    >
      {children}
    </DrawerContent>
  );
}
