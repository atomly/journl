"use client";

import type { Subscription } from "@acme/api";
import { useMutation } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
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
  activeSubscription: Subscription;
} & ComponentProps<typeof Button>) => {
  const pathname = usePathname();
  const trpc = useTRPC();
  const router = useRouter();

  const { mutate: openBillingPortal, isPending } = useMutation(
    trpc.subscription.createBillingPortal.mutationOptions({
      onError: (error) => {
        toast.error(error.message || "Failed to open billing portal");
      },
      onSuccess: (res) => {
        router.push(res.url);
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
      variant="background"
      disabled={isPending}
      {...buttonProps}
    >
      {children}
    </Button>
  );
};
