"use client";
import { useAppPreferences } from "~/components/preferences/app-preferences-provider";
import { Sidebar } from "~/components/ui/sidebar";
import {
  CHAT_SIDEBAR_EXPANDED_WIDTH_REM,
  CHAT_SIDEBAR_WIDTH_REM_DEFAULT,
  CHAT_SIDEBAR_WIDTH_REM_MAX,
  CHAT_SIDEBAR_WIDTH_REM_MIN,
} from "~/preferences/app-preferences";
export function ChatSidebarFrame({ children }: { children: React.ReactNode }) {
  const { preferences } = useAppPreferences();
  const expanded = preferences.chatSidebarWidthRem > CHAT_SIDEBAR_WIDTH_REM_MAX;
  return (
    <Sidebar
      side="right"
      collapsible="offcanvas"
      variant="floating"
      defaultWidth={`${CHAT_SIDEBAR_WIDTH_REM_DEFAULT}rem`}
      minWidth={`${CHAT_SIDEBAR_WIDTH_REM_MIN}rem`}
      maxWidth={`${expanded ? CHAT_SIDEBAR_EXPANDED_WIDTH_REM : CHAT_SIDEBAR_WIDTH_REM_MAX}rem`}
    >
      {children}
    </Sidebar>
  );
}
