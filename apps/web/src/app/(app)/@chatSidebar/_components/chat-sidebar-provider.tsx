"use client";

import * as React from "react";
import { useAppPreferences } from "~/components/preferences/app-preferences-provider";
import { SidebarProvider } from "~/components/ui/sidebar";
import { useIsMobile } from "~/components/ui/use-shell-viewport";

const AssistantPanelOpen = React.createContext(false);
export function useAssistantPanelOpen() {
  return React.useContext(AssistantPanelOpen);
}

type ChatSidebarProviderProps = Omit<
  React.ComponentProps<typeof SidebarProvider>,
  "open" | "onOpenChange" | "initialWidthRem" | "onResizeEnd"
>;

export function ChatSidebarProvider({
  children,
  ...props
}: ChatSidebarProviderProps) {
  const { preferences, updatePreferences } = useAppPreferences();
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(() => preferences.chatSidebarOpen);
  const openRef = React.useRef(open);
  openRef.current = open;

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (openRef.current === nextOpen) {
        return;
      }

      openRef.current = nextOpen;
      if (!isMobile) {
        updatePreferences({ chatSidebarOpen: nextOpen });
      }

      setOpen(nextOpen);
    },
    [isMobile, updatePreferences],
  );

  const handleResizeEnd = React.useCallback(
    (widthRem: number) => {
      if (isMobile) {
        return;
      }

      updatePreferences({ chatSidebarWidthRem: widthRem });
    },
    [isMobile, updatePreferences],
  );

  return (
    <AssistantPanelOpen value={open}>
      <SidebarProvider
        {...props}
        open={open}
        onOpenChange={handleOpenChange}
        initialWidthRem={preferences.chatSidebarWidthRem}
        onResizeEnd={handleResizeEnd}
      >
        {children}
      </SidebarProvider>
    </AssistantPanelOpen>
  );
}
