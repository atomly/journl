import { CreditCard } from "lucide-react";
import { redirect } from "next/navigation";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { api } from "~/trpc/server";
import { SubscriptionInfo } from "../../_components/billing/subscription-info";
import { SubscriptionManageButton } from "../../(billing)/subscription/_components/subscription-manage-button";
import { SubscriptionModal } from "./_components/subscription-modal";

export default async function SubscriptionBillingModalPage() {
  const subscription = await api.subscription.getActiveSubscription();
  if (!subscription) {
    return redirect("/");
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
    <SubscriptionModal>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Subscription</DialogTitle>
        </DialogHeader>
        <SubscriptionInfo activeSubscription={subscription} />
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
      </DialogContent>
    </SubscriptionModal>
  );
}
