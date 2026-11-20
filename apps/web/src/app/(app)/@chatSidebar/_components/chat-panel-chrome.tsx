"use client";

import { Button } from "@acme/ui/button";
import { Maximize2, Minimize2, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { useAppPreferences } from "~/components/preferences/app-preferences-provider";
import { useSidebar } from "~/components/ui/sidebar";
import { useJournlAgent } from "~/hooks/use-journl-agent";

export function AssistantIdentity() {
  const agent = useJournlAgent();
  const pathname = usePathname();
  const context = useSyncExternalStore(
    agent.subscribe,
    () => {
      const view = agent.getView();
      if (view.name === "page") return view.title || "Page";
      if (view.name === "journal-entry")
        return new Date(`${view.date}T12:00:00`).toLocaleDateString("en-US", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
      if (view.name === "journal") return "Journal";
      return pathname.startsWith("/explore") || pathname.startsWith("/graph")
        ? "Explore"
        : "Your notebook";
    },
    () => "Your notebook",
  );
  return (
    <div className="min-w-0 flex-1">
      <h2 className="font-semibold text-[15px] leading-[1.2]">Ask Journl</h2>
      <p className="sr-only">{context} · AI assistant</p>
    </div>
  );
}

export function ChatPanelChrome() {
  const { setOpen } = useSidebar();
  const { preferences, updatePreferences } = useAppPreferences();
  const expanded = preferences.chatSidebarWidthRem === 44;
  return (
    <div className="flex h-[62px] shrink-0 items-center gap-2 border-b px-4">
      <AssistantIdentity />
      <Button
        variant="ghost"
        size="icon"
        aria-label={expanded ? "Default assistant width" : "Expand assistant"}
        onClick={() =>
          updatePreferences({ chatSidebarWidthRem: expanded ? 30 : 44 })
        }
      >
        {expanded ? (
          <Minimize2 className="size-4" />
        ) : (
          <Maximize2 className="size-4" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Close assistant"
        onClick={() => setOpen(false)}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
