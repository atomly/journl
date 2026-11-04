"use client";
import { Button, buttonVariants } from "@acme/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@acme/ui/dialog";
import { cn } from "cn";
import Link from "next/link";
import { useEffect } from "react";

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
            <Link
              href="/journal"
              className={cn(
                buttonVariants({ size: "default", variant: "default" }),
              )}
            >
              Go back to your Journal
            </Link>
            <Button onClick={reset}>Try Again</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
