import {
  Ban,
  Calendar,
  CheckCircle,
  CreditCard,
  Info,
  Shield,
  SquareArrowUpRight,
  Zap,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { cn } from "~/lib/cn";
import { centsToDollars } from "~/lib/currency";
import type { Subscription } from "~/trpc";
import { SubscriptionManageButton } from "./subscription-manage-button";

type SubscriptionInfoProps = {
  subscription: Exclude<Subscription, null>;
  className?: string;
};

export async function SubscriptionView({
  subscription,
  className,
}: SubscriptionInfoProps) {
  const cancelDate =
    subscription?.cancelAtPeriodEnd && subscription.periodEnd
      ? new Date(subscription.periodEnd).toLocaleDateString("en-US", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;

  const periodStart = subscription?.periodStart?.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const periodEnd = subscription?.periodEnd?.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const planName = subscription.plan.displayName;
  const planPrice = centsToDollars(subscription.plan.price.unitAmount, {
    decimals: 2,
  });
  const billingInterval = subscription.plan.price.recurring.interval;

  return (
    <Card
      className={cn("relative overflow-hidden border-2 shadow-xl", className)}
    >
      {/* Premium Badge */}
      <div className="absolute top-4 right-4">
        <Badge
          variant={cancelDate ? "background" : "default"}
          className="border px-3 py-1 font-semibold"
        >
          {cancelDate ? (
            <>
              <Ban className="mr-1 h-3 w-3" />
              Cancelled
            </>
          ) : (
            <>
              <Zap className="mr-1 h-3 w-3" />
              Active
            </>
          )}
        </Badge>
      </div>

      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h2 className="font-bold text-3xl text-foreground capitalize">
              {planName}
            </h2>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-4xl text-primary">
                {planPrice}
              </span>
              <span className="text-lg text-muted-foreground">
                per {billingInterval}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Billing Period */}
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">
              Current Billing Period
            </p>
            <p className="text-muted-foreground text-sm">
              {periodStart && periodEnd
                ? `${periodStart} - ${periodEnd}`
                : "September 20, 2025 - October 20, 2025"}
            </p>
          </div>
          <Info className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Cancellation Notice */}
        {cancelDate && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <Info className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-destructive">
                Subscription Ending
              </p>
              <p className="text-muted-foreground text-sm">
                Your subscription will be canceled on {cancelDate}
              </p>
            </div>
          </div>
        )}

        {/* Features Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 font-semibold text-foreground">
              <Shield className="h-4 w-4 text-primary" />
              Premium Features
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>Personalized assistant</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>Unlimited journal and pages</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>Based solely on your information</span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="flex items-center gap-2 font-semibold text-foreground">
              <CreditCard className="h-4 w-4 text-primary" />
              Billing & Security
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>Secure payments</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>Cancel anytime</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4">
          <SubscriptionManageButton
            activeSubscription={subscription}
            size="lg"
            className="w-full rounded-lg border px-8 py-3 font-semibold shadow-lg md:w-auto"
          >
            <SquareArrowUpRight />
            {cancelDate ? "Don't cancel subscription" : "Manage Subscription"}
          </SubscriptionManageButton>
        </div>
      </CardContent>
    </Card>
  );
}
