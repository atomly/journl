"use client";

import { CreditCard } from "lucide-react";
import { UserButton } from "~/components/auth/user/user-button";
import { useSidebar } from "~/components/ui/sidebar";

export function AppSidebarUserDropdown({
  hasSubscription,
}: {
  hasSubscription: boolean;
}) {
  const { isMobile } = useSidebar();
  return (
    <UserButton
      className="w-full min-w-0 justify-start rounded-lg px-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[popup-open]:bg-sidebar-accent"
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
