"use client";

import { Button } from "@acme/ui/button";
import { Maximize2, Minimize2, X } from "lucide-react";
import { useSidebar } from "~/components/ui/sidebar";

export function ChatPanelHeader() {
  const { setOpen, panelWidthRem, setPanelWidthRem, handleResizeEnd } =
    useSidebar();
  const expanded = (panelWidthRem ?? 30) >= 44;
  return (
    <header className="journl-glass flex h-24 shrink-0 items-center gap-2 rounded-t-3xl px-4">
      <span className="mr-auto font-semibold text-[28px] tracking-tight">
        Ask Journl
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label={expanded ? "Restore assistant width" : "Expand assistant"}
        onClick={() => {
          const width = expanded ? 30 : 44;
          setPanelWidthRem(width);
          handleResizeEnd(width);
        }}
      >
        {expanded ? <Minimize2 /> : <Maximize2 />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Close assistant"
        onClick={() => {
          setOpen(false);
          requestAnimationFrame(() =>
            document
              .querySelector<HTMLButtonElement>("[data-assistant-trigger]")
              ?.focus(),
          );
        }}
      >
        <X />
      </Button>
    </header>
  );
}
