"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

export default function SubscriptionModalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Subscription modal error:", error);
  }, [error]);

  return (
    <Dialog open={true}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subscription Error</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-muted-foreground">
            We encountered an error while loading your subscription information.
          </p>
          <div className="flex justify-end space-x-2">
            <Button asChild>
              <Link href="/journal">Go back to your Journal</Link>
            </Button>
            <Button onClick={reset}>Try Again</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
