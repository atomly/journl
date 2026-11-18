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
  const [tabletOpen, setTabletOpen] = React.useState(false);
  const [isTablet, setIsTablet] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia(
      "(min-width: 701px) and (max-width: 1100px)",
    );
    const sync = () => setIsTablet(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const [open, setOpen] = React.useState(() => preferences.appSidebarOpen);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (isTablet) {
        setTabletOpen(nextOpen);
        return;
      }
      if (open === nextOpen) {
        return;
      }

      if (!isMobile) {
        updatePreferences({ appSidebarOpen: nextOpen });
      }

      setOpen(nextOpen);
    },
    [open, isMobile, isTablet, updatePreferences],
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
      open={isTablet ? tabletOpen : open}
      onOpenChange={handleOpenChange}
      initialWidthRem={preferences.appSidebarWidthRem}
      onResizeEnd={handleResizeEnd}
    >
      {children}
    </SidebarProvider>
  );
}
