"use client";

import { useMutation } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ProPlan, Subscription } from "~/trpc";
import { useTRPC } from "~/trpc/react";
import { Button } from "../../../../components/ui/button";

const CANCEL_URL = "/journal";
const SUCCESS_URL = "/journal";

type HeaderSubscriptionButtonProps = {
  subscription: Subscription;
  plan: Exclude<ProPlan, null>;
};

export function HeaderSubscriptionButton({
  subscription,
  plan,
}: HeaderSubscriptionButtonProps) {
  const pathname = usePathname();
  const trpc = useTRPC();
  const router = useRouter();
  const { mutateAsync: upgradeSubscription, isPending: isUpgrading } =
    useMutation(
      trpc.subscription.upgradeSubscription.mutationOptions({
        onError: (error) => {
          console.error("Subscription upgrade error:", error);
          // Handle specific error cases if needed
          toast.error("Failed to upgrade subscription");
        },
      }),
    );
  const { mutate: openBillingPortal, isPending: isOpeningBillingPortal } =
    useMutation(
      trpc.subscription.createBillingPortal.mutationOptions({
        onError: (error) => {
          toast.error(error.message || "Failed to open billing portal");
        },
        onSuccess: (res) => {
          router.push(res.url);
        },
      }),
    );

  async function handleClick() {
    if (subscription) {
      return openBillingPortal({
        returnUrl: pathname,
      });
    }

    const res = await upgradeSubscription({
      cancelUrl: CANCEL_URL,
      plan: plan.name,
      returnUrl: pathname,
      successUrl: SUCCESS_URL,
    });

    if (res.url) {
      router.push(res.url);
    } else {
      toast.error("Failed to create checkout session");
    }
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isUpgrading || isOpeningBillingPortal}
      size="sm"
      className="rounded-md border"
      variant="background"
    >
      {subscription ? (
        <>
          <span className="inline @[320px]:hidden">Stay Subscribed</span>
          <span className="@[320px]:inline hidden">Continue Membership</span>
        </>
      ) : (
        <>
          <span className="inline @[280px]:hidden">Upgrade</span>
          <span className="@[280px]:inline hidden">
            Upgrade to {plan.displayName}
          </span>
        </>
      )}
    </Button>
  );
}
