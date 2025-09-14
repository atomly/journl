"use client";

import type { ActiveSubscription } from "@acme/api";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "~/auth/client";
import { Button } from "~/components/ui/button";

export const SubscriptionManageButton = ({
  activeSubscription,
  children,
  onClick,
  ...buttonProps
}: {
  activeSubscription: ActiveSubscription;
} & ComponentProps<typeof Button>) => {
  const pathname = usePathname();
  const { data: sessionData } = authClient.useSession();
  const [isLoading, setIsLoading] = useState(false);

  if (!activeSubscription) {
    return null;
  }

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    setIsLoading(true);

    if (!sessionData?.user?.id) {
      toast.error("Please sign in to manage your subscription");
      return;
    }

    const result = await authClient.subscription.billingPortal({
      locale: "en",
      referenceId: sessionData.user.id,
      returnUrl: pathname,
    });

    if (result.error) {
      console.error("Billing portal error:", result.error);
      toast.error("Failed to open billing portal. Please try again.");
    }

    // Call the custom onClick handler if provided
    onClick?.(event);
    setIsLoading(false);
  };

  return (
    <Button
      onClick={handleClick}
      size="sm"
      className="rounded-lg bg-black text-white"
      variant="outline"
      disabled={isLoading}
      {...buttonProps}
    >
      {children}
    </Button>
  );
};
