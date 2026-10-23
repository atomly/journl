"use client";

import { useIsMobile } from "@acme/ui/use-mobile";
import * as React from "react";
import { useAppPreferences } from "~/components/preferences/app-preferences-provider";
import { SidebarProvider } from "~/components/ui/sidebar";

type AppSidebarProviderProps = Omit<
  React.ComponentProps<typeof SidebarProvider>,
  "open" | "onOpenChange" | "initialWidthRem" | "onResizeEnd"
>;

export function AppSidebarProvider({
  children,
  ...props
}: AppSidebarProviderProps) {
  const { preferences, updatePreferences } = useAppPreferences();
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(() => preferences.appSidebarOpen);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (open === nextOpen) {
        return;
      }

      if (!isMobile) {
        updatePreferences({ appSidebarOpen: nextOpen });
      }

      setOpen(nextOpen);
    },
    [open, isMobile, updatePreferences],
  );

  const handleResizeEnd = React.useCallback(
    (widthRem: number) => {
      if (isMobile) {
        return;
      }

      updatePreferences({ appSidebarWidthRem: widthRem });
    },
    [isMobile, updatePreferences],
  );

  return (
    <SidebarProvider
      {...props}
      open={open}
      onOpenChange={handleOpenChange}
      initialWidthRem={preferences.appSidebarWidthRem}
      onResizeEnd={handleResizeEnd}
    >
      {children}
    </SidebarProvider>
  );
}
