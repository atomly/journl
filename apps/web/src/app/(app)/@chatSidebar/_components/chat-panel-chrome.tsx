"use client";

import { Button } from "@acme/ui/button";
import { Maximize2, Minimize2, PanelRight, Sparkle } from "lucide-react";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { useAppPreferences } from "~/components/preferences/app-preferences-provider";
import { useSidebar } from "~/components/ui/sidebar";
import { useJournlAgent } from "~/hooks/use-journl-agent";
import {
  CHAT_SIDEBAR_WIDTH_REM_DEFAULT,
  CHAT_SIDEBAR_WIDTH_REM_MAX,
} from "~/preferences/app-preferences";

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
      <h2 className="flex items-center gap-2 font-[720] text-[15px] leading-[1.55]">
        <Sparkle
          aria-hidden="true"
          className="size-4 text-sidebar-accent-foreground"
        />
        Ask Journl
      </h2>
      <p className="sr-only">{context} · AI assistant</p>
    </div>
  );
}

export function ChatPanelChrome() {
  const { setOpen } = useSidebar();
  const { preferences, updatePreferences } = useAppPreferences();
  const expanded = preferences.chatSidebarWidthRem > CHAT_SIDEBAR_WIDTH_REM_MAX;
  return (
    <div className="flex h-[62px] shrink-0 items-center gap-2 border-b px-4">
      <AssistantIdentity />
      <Button
        variant="ghost"
        size="icon"
        aria-label={expanded ? "Default assistant width" : "Expand assistant"}
        onClick={() =>
          updatePreferences({
            chatSidebarWidthRem: expanded ? CHAT_SIDEBAR_WIDTH_REM_DEFAULT : 44,
          })
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
        <PanelRight className="size-4" />
      </Button>
    </div>
  );
}
