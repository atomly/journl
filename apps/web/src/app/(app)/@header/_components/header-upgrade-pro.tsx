"use client";

import type { ActiveSubscription } from "@acme/api";
import { useMutation } from "@tanstack/react-query";
import { redirect, usePathname } from "next/navigation";
import { toast } from "sonner";
import { useTRPC } from "~/trpc/react";
import { Button } from "../../../../components/ui/button";

export function HeaderUpgradePro({
  activeSubscription,
}: {
  activeSubscription: ActiveSubscription;
}) {
  const pathname = usePathname();
  const trpc = useTRPC();
  const { mutateAsync: upgradeSubscription, isPending } = useMutation(
    trpc.subscription.upgradeSubscription.mutationOptions({
      onError: (error) => {
        console.error("Subscription upgrade error:", error);
        // Handle specific error cases if needed
        toast.error("Failed to upgrade subscription");
      },
    }),
  );

  if (activeSubscription?.status === "active") {
    return null;
  }

  return (
    <Button
      onClick={async () => {
        const res = await upgradeSubscription({
          cancelUrl: `/payment/cancel?redirect=${encodeURIComponent(pathname)}`,
          plan: "pro",
          returnUrl: pathname,
          successUrl: `/payment/success?redirect=${encodeURIComponent(pathname)}`,
        });
        if (res.url) {
          redirect(res.url);
        } else {
          toast.error("Failed to create checkout session");
        }
      }}
      disabled={isPending}
      size="sm"
      className="rounded-lg bg-black text-white"
    >
      <span className="inline @[280px]:hidden">Upgrade</span>
      <span className="@[280px]:inline hidden">Upgrade to Pro</span>
    </Button>
  );
}
