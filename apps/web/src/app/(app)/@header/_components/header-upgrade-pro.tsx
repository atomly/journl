"use client";

import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "~/auth/client";
import type { auth } from "~/auth/server";
import { Button } from "../../../../components/ui/button";

type ActiveSubscription =
  | Awaited<ReturnType<typeof auth.api.listActiveSubscriptions>>[0]
  | undefined;

export function HeaderUpgradePro({
  activeSubscription,
}: {
  activeSubscription: ActiveSubscription;
}) {
  const currentUrl = usePathname();

  if (activeSubscription?.status === "active") {
    return null;
  }

  return (
    <Button
      onClick={async () => {
        const { error } = await authClient.subscription.upgrade({
          cancelUrl: `/payment/cancel?redirect=${encodeURIComponent(currentUrl)}`,
          plan: "pro",
          successUrl: `/payment/success?redirect=${encodeURIComponent(currentUrl)}`,
        });

        if (error) {
          console.error("Subscription upgrade error:", error);
          if (error.code === "YOURE_ALREADY_SUBSCRIBED_TO_THIS_PLAN") {
            toast.error("You are already subscribed to this plan");
          }
        }
      }}
      size="sm"
      className="rounded-lg bg-black text-white"
    >
      <span className="inline @[280px]:hidden">Upgrade</span>
      <span className="@[280px]:inline hidden">Upgrade to Pro</span>
    </Button>
  );
}
