"use client";

import { useEffect } from "react";
import { Button } from "~/components/ui/button";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

export default function BillingModalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Billing modal error:", error);
  }, [error]);

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Billing Error</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <p className="text-muted-foreground">
          We encountered an error while loading your billing information.
        </p>
        <div className="flex justify-end space-x-2">
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Go Home
          </Button>
          <Button onClick={reset}>Try Again</Button>
        </div>
      </div>
    </DialogContent>
  );
}
