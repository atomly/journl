"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "~/components/ui/dialog";

export const SubscriptionModal = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setIsOpen(false);
      router.back();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {children}
    </Dialog>
  );
};
