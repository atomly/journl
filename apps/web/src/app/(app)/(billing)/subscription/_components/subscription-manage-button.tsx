"use client";

import type { ActiveSubscription } from "@acme/api";
import { useMutation } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { useTRPC } from "~/trpc/react";

export const SubscriptionManageButton = ({
  activeSubscription,
  children,
  onClick,
  ...buttonProps
}: {
  activeSubscription: ActiveSubscription;
} & ComponentProps<typeof Button>) => {
  const pathname = usePathname();
  const trpc = useTRPC();

  const { mutate: openBillingPortal, isPending } = useMutation(
    trpc.subscription.openBillingPortal.mutationOptions({
      onError: (error) => {
        toast.error(error.message || "Failed to open billing portal");
      },
      onSuccess: (res) => {
        window.location.href = res.url;
      },
    }),
  );

  if (!activeSubscription) {
    return null;
  }

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    openBillingPortal({
      returnUrl: pathname,
    });
    onClick?.(event);
  };

  return (
    <Button
      onClick={handleClick}
      size="sm"
      className="rounded-lg bg-black text-white"
      variant="outline"
      disabled={isPending}
      {...buttonProps}
    >
      {children}
    </Button>
  );
};
