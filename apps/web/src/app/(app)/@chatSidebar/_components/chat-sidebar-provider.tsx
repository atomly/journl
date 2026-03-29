"use client";

import * as React from "react";
import { useAppPreferences } from "~/components/preferences/app-preferences-provider";
import { SidebarProvider } from "~/components/ui/sidebar";
import { useIsMobile } from "~/hooks/use-mobile";

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

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (open === nextOpen) {
        return;
      }

      if (!isMobile) {
        updatePreferences({ chatSidebarOpen: nextOpen });
      }

      setOpen(nextOpen);
    },
    [isMobile, updatePreferences, open],
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
    <SidebarProvider
      {...props}
      open={open}
      onOpenChange={handleOpenChange}
      initialWidthRem={preferences.chatSidebarWidthRem}
      onResizeEnd={handleResizeEnd}
    >
      {children}
    </SidebarProvider>
  );
}
