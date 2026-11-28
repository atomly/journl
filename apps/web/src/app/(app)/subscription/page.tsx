import { Card, CardContent } from "@acme/ui/card";
import { CreditCard, Shield } from "lucide-react";
import { redirect } from "next/navigation";
import { withAuth } from "~/app/_guards/page-guards";
import { centsToDollars } from "~/lib/currency";
import { api } from "~/trpc/server";
import { SubscriptionView } from "./_components/subscription-view";

export const dynamic = "force-dynamic";

async function SubscriptionPage() {
  const subscription = await api.subscription.getSubscription();

  if (!subscription) {
    redirect("/journal");
  }

  const cancelDate =
    subscription?.cancelAtPeriodEnd && subscription.periodEnd
      ? new Date(subscription.periodEnd).toLocaleDateString("en-US", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;

  const periodEnd = subscription.periodEnd;
  const upcomingPeriodEnd = periodEnd && periodEnd.getTime() > Date.now();
  const nextBillingDate = upcomingPeriodEnd
    ? periodEnd.toLocaleDateString("en-US", { dateStyle: "long" })
    : null;

  const planPrice = centsToDollars(subscription.plan.price.unitAmount, {
    decimals: 2,
  });

  return (
    <div data-workspace-section className="pt-8 pb-24 text-card-foreground">
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col gap-3">
          <h1 className="text-balance font-semibold text-3xl tracking-tight md:text-[40px]">
            Plan Summary
          </h1>
          <p className="max-w-2xl text-pretty text-muted-foreground">
            Your premium subscription is active and ready to power your
            productivity
          </p>
        </div>

        {/* Main Plan Card */}
        <SubscriptionView subscription={subscription} />

        {/* Additional Info Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="rounded-xl bg-secondary/50 shadow-none">
            <CardContent>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <CreditCard className="size-5" />
                </div>
                <h3 className="font-semibold">Next Billing</h3>
              </div>
              <p className="mb-1 font-bold text-2xl text-foreground">
                {nextBillingDate || "Unavailable"}
              </p>
              <p className="text-muted-foreground text-sm">
                {cancelDate && nextBillingDate
                  ? "Subscription will end at the current period"
                  : nextBillingDate
                    ? `Your next charge of ${planPrice} will be processed automatically`
                    : "Check your billing portal for the next charge."}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl bg-secondary/50 shadow-none">
            <CardContent>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Shield className="size-5" />
                </div>
                <h3 className="font-semibold">Account Status</h3>
              </div>
              <p className="mb-1 font-bold text-2xl text-foreground">
                {cancelDate ? "Ending" : "Active"}
              </p>
              <p className="text-muted-foreground text-sm">
                {cancelDate
                  ? "Subscription will end at the current period"
                  : "All features are available and working perfectly"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default withAuth(SubscriptionPage);
