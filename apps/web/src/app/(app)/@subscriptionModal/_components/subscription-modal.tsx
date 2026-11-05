"use client";

import { Dialog } from "@acme/ui/dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SubscriptionModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);

  function handleOpenChange(open: boolean) {
    if (!open) {
      setIsOpen(false);
      router.back();
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {children}
    </Dialog>
  );
}
