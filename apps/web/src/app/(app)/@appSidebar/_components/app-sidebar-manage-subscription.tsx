import type { Subscription } from "@acme/api";
import { CreditCard } from "lucide-react";
import Link from "next/link";
import { DropdownMenuItem } from "~/components/ui/dropdown-menu";

type AppSidebarManageSubscriptionProps = {
  subscription: Subscription;
};

export function AppSidebarManageSubscription({
  subscription,
}: AppSidebarManageSubscriptionProps) {
  if (!subscription) {
    return null;
  }

  return (
    <DropdownMenuItem asChild className={"w-full cursor-pointer"}>
      <Link href="/subscription" className="flex items-center gap-2">
        <CreditCard />
        Subscription
      </Link>
    </DropdownMenuItem>
  );
}
