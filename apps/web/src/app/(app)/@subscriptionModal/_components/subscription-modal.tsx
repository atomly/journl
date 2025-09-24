"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "~/components/ui/dialog";

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
