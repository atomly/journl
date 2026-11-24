"use client";

import * as React from "react";
import { useAppPreferences } from "~/components/preferences/app-preferences-provider";
import { SidebarProvider, useSidebar } from "~/components/ui/sidebar";
import { useIsMobile } from "~/components/ui/use-shell-viewport";

import { useNavigationSidebar } from "../../@appSidebar/_components/app-sidebar-provider";

const AssistantPanelOpen = React.createContext(false);
const AssistantOverlay = React.createContext(false);
export function useAssistantOverlay() {
  return React.useContext(AssistantOverlay);
}
function subscribeViewport(listener: () => void) {
  window.addEventListener("resize", listener);
  return () => window.removeEventListener("resize", listener);
}
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
        <AssistantGeometry>{children}</AssistantGeometry>
      </SidebarProvider>
    </AssistantPanelOpen>
  );
}

function AssistantGeometry({ children }: { children: React.ReactNode }) {
  const navigation = useNavigationSidebar();
  const assistant = useSidebar();
  const width = React.useSyncExternalStore(
    subscribeViewport,
    () => window.innerWidth,
    () => 1440,
  );
  const navigationWidth =
    width <= 1100 || navigation.state === "collapsed"
      ? 64
      : navigation.widthRem * 16;
  const overlay =
    !assistant.isMobile &&
    (width <= 1100 ||
      width - navigationWidth - assistant.widthRem * 16 - 64 < 560);
  return (
    <AssistantOverlay value={overlay}>
      <div className="contents" data-assistant-overlay={overlay}>
        {children}
      </div>
    </AssistantOverlay>
  );
}
