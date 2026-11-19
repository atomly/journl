"use client";

import { cn } from "cn";
import { CreditCard, MoreHorizontal } from "lucide-react";
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
    <div data-navigation-account-wrapper className="relative w-full min-w-0">
      <UserButton
        size={compact ? "icon" : "default"}
        className={cn(
          "journl-navigation-account w-full min-w-0 rounded-[12px] border-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[popup-open]:bg-sidebar-accent data-[popup-open]:text-sidebar-accent-foreground",
          compact
            ? "h-8 p-0"
            : "justify-start px-0 [&>svg:last-child]:invisible",
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
      {!compact && (
        <MoreHorizontal
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-1 size-5 -translate-y-1/2"
        />
      )}
    </div>
  );
}
