"use client";

import type { ActiveSubscription } from "@acme/api";
import { Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import { authClient } from "~/auth/client";
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
  const { data: sessionData } = authClient.useSession();

  if (!activeSubscription) {
    return null;
  }

  const handleClick = () => {
    authClient.subscription.billingPortal({
      locale: "en",
      referenceId: sessionData?.user?.id,
      returnUrl: pathname,
    });
  };

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem className="w-full cursor-pointer" onClick={handleClick}>
        <Settings />
        Manage Subscription
      </DropdownMenuItem>
    </>
  );
};
