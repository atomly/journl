"use client";

import * as React from "react";
import { useAppPreferences } from "~/components/preferences/app-preferences-provider";
import {
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "~/components/ui/sidebar";
import {
  useIsMobile,
  useShellViewport,
} from "~/components/ui/use-shell-viewport";

const NavigationSidebar = React.createContext<ReturnType<
  typeof useSidebar
> | null>(null);
function NavigationScope({ children }: { children: React.ReactNode }) {
  const sidebar = useSidebar();
  return <NavigationSidebar value={sidebar}>{children}</NavigationSidebar>;
}
export function useNavigationSidebar() {
  const sidebar = React.useContext(NavigationSidebar);
  if (!sidebar)
    throw new Error(
      "Navigation sidebar is unavailable outside AppSidebarProvider",
    );
  return sidebar;
}

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
  const viewport = useShellViewport();
  const [tabletOpen, setTabletOpen] = React.useState(false);
  const [open, setOpen] = React.useState(() => preferences.appSidebarOpen);
  const openRef = React.useRef(open);
  openRef.current = open;

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (viewport === "tablet") {
        setTabletOpen(nextOpen);
        return;
      }
      if (openRef.current === nextOpen) {
        return;
      }

      openRef.current = nextOpen;
      if (!isMobile) {
        updatePreferences({ appSidebarOpen: nextOpen });
      }

      setOpen(nextOpen);
    },
    [isMobile, updatePreferences, viewport],
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
      open={viewport === "tablet" ? tabletOpen : open}
      onOpenChange={handleOpenChange}
      initialWidthRem={preferences.appSidebarWidthRem}
      onResizeEnd={handleResizeEnd}
    >
      <NavigationScope>{children}</NavigationScope>
    </SidebarProvider>
  );
}

export function NavigationSidebarClose() {
  return (
    <SidebarTrigger
      aria-label="Close navigation"
      className="hidden group-data-[collapsible=icon]:hidden min-[701px]:max-[1101px]:inline-flex"
      onClick={() =>
        document
          .querySelector<HTMLButtonElement>('header [data-sidebar="trigger"]')
          ?.focus()
      }
    />
  );
}
