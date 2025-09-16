"use client";

import type { ActiveSubscription } from "@acme/api";
import { CreditCard } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";

export const AppSidebarManageSubscription = ({
  activeSubscription,
}: {
  activeSubscription: ActiveSubscription;
}) => {
  const pathname = usePathname();

  if (!activeSubscription) {
    return null;
  }

  const isOnSubscriptionPage = pathname === "/subscription";

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild className={"w-full cursor-pointer"}>
        {isOnSubscriptionPage ? (
          <div className="flex items-center gap-2">
            <CreditCard />
            Subscription
          </div>
        ) : (
          <Link href="/subscription" className="flex items-center gap-2">
            <CreditCard />
            Subscription
          </Link>
        )}
      </DropdownMenuItem>
    </>
  );
};
