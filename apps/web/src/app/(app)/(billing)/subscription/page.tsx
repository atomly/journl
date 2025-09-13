import { CreditCard } from "lucide-react";
import { redirect } from "next/navigation";
import { Card, CardContent } from "~/components/ui/card";
import { api } from "~/trpc/server";
import { SubscriptionInfo } from "../../_components/billing/subscription-info";
import { SubscriptionManageButton } from "./_components/subscription-manage-button";

export default async function SubscriptionPage() {
  const subscription = await api.subscription.getActiveSubscription();
  if (!subscription) {
    redirect("/");
  }

  // Format the cancellation date if subscription is set to cancel at period end
  const cancelDate =
    subscription.cancelAtPeriodEnd && subscription.periodEnd
      ? new Date(subscription.periodEnd).toLocaleDateString("en-US", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;

  return (
    <div className="container mx-full p-8">
      <div className="space-y-6">
        <div>
          <h1 className="font-semibold text-2xl text-foreground">
            Current Subscription
          </h1>
        </div>
        <Card>
          <CardContent>
            <SubscriptionInfo activeSubscription={subscription} />
          </CardContent>
        </Card>
        {/* Action Button */}
        <div className="flex justify-end">
          {cancelDate ? (
            <SubscriptionManageButton activeSubscription={subscription}>
              Don't cancel subscription
            </SubscriptionManageButton>
          ) : (
            <SubscriptionManageButton activeSubscription={subscription}>
              <CreditCard />
              Manage Subscription
            </SubscriptionManageButton>
          )}
        </div>
      </div>
    </div>
  );
}
