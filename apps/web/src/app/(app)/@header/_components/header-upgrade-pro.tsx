"use client";

import type { ActiveSubscription } from "@acme/api";
import { useMutation } from "@tanstack/react-query";
import { redirect, usePathname } from "next/navigation";
import { toast } from "sonner";
import { useTRPC } from "~/trpc/react";
import { Button } from "../../../../components/ui/button";

export function HeaderUpgradePro({
  activeSubscription,
  planName,
}: {
  activeSubscription: ActiveSubscription;
  planName: string;
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
          cancelUrl: "/",
          plan: planName,
          returnUrl: pathname,
          successUrl: "/",
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
      <span className="@[280px]:inline hidden">
        Upgrade to {planName.charAt(0).toUpperCase() + planName.slice(1)}
      </span>
    </Button>
  );
}
