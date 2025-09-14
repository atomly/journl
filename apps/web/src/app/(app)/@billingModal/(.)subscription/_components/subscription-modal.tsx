"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Dialog } from "~/components/ui/dialog";
import { BillingErrorBoundary } from "../../_components/billing-error-boundary";

export const SubscriptionModal = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // Use effect to prevent hydration mismatch and flashing
  useEffect(() => {
    setIsOpen(pathname === "/subscription");
  }, [pathname]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setIsOpen(false);
      router.back();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <BillingErrorBoundary>{children}</BillingErrorBoundary>
    </Dialog>
  );
};
