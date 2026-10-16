"use client";

import { cn } from "cn";
import { CreditCard } from "lucide-react";
import { UserButton } from "~/components/auth/user/user-button";
import { useSidebar } from "~/components/ui/sidebar";

export function AppSidebarUserDropdown({
  hasSubscription,
}: {
  hasSubscription: boolean;
}) {
  const { isMobile, state } = useSidebar();
  const compact = !isMobile && state === "collapsed";
  return (
    <UserButton
      size={compact ? "icon" : "default"}
      className={cn(
        "w-full min-w-0 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[popup-open]:bg-sidebar-accent",
        compact ? "h-10 p-1" : "justify-start px-2",
      )}
      side={isMobile ? "bottom" : "right"}
      align="start"
      sideOffset={4}
      links={
        hasSubscription
          ? [
              {
                href: "/subscription",
                icon: <CreditCard />,
                label: "Subscription",
                visibility: "authenticated",
              },
            ]
          : undefined
      }
    />
  );
}
