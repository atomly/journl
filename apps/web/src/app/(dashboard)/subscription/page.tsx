import { CreditCard, Shield } from "lucide-react";
import { redirect } from "next/navigation";
import { withAuth } from "~/app/_guards/page-guards";
import { Card, CardContent } from "~/components/ui/card";
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

  const nextBillingDate = subscription?.periodEnd?.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
  });

  const planPrice = centsToDollars(subscription.plan.price.unitAmount, {
    decimals: 2,
  });

  return (
    <div className="h-full w-full p-8">
      <div className="space-y-8">
        {/* Header Section */}
        <div className="space-y-4 text-center">
          <h1 className="text-balance font-bold text-4xl md:text-5xl">
            Plan Summary
          </h1>
          <p className="mx-auto max-w-2xl text-pretty text-lg text-muted-foreground">
            Your premium subscription is active and ready to power your
            productivity
          </p>
        </div>

        {/* Main Plan Card */}
        <SubscriptionView subscription={subscription} />

        {/* Additional Info Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-2">
            <CardContent>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <CreditCard className="size-5" />
                </div>
                <h3 className="font-semibold">Next Billing</h3>
              </div>
              <p className="mb-1 font-bold text-2xl text-foreground">
                {nextBillingDate || "October 20"}
              </p>
              <p className="text-muted-foreground text-sm">
                {cancelDate
                  ? "Subscription will end at the current period"
                  : `Your next charge of ${planPrice} will be processed automatically`}
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Shield className="size-5" />
                </div>
                <h3 className="font-semibold">Account Status</h3>
              </div>
              <p className="mb-1 font-bold text-2xl text-primary">
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
