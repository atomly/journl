"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "~/components/ui/button";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class BillingErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error, hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Billing modal error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Something went wrong</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              We encountered an error while loading your billing information.
            </p>
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  this.setState({ error: undefined, hasError: false });
                  window.location.reload();
                }}
                variant="outline"
              >
                Refresh Page
              </Button>
            </div>
          </div>
        </DialogContent>
      );
    }

    return this.props.children;
  }
}
