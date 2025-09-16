import type { ActiveSubscription } from "@acme/api";
import { CreditCard, Edit, Info } from "lucide-react";
import { Separator } from "~/components/ui/separator";
import { SubscriptionManageButton } from "../../(billing)/subscription/_components/subscription-manage-button";

export function SubscriptionInfo({
  activeSubscription,
}: {
  activeSubscription: ActiveSubscription;
}) {
  const cancelDate =
    activeSubscription?.cancelAtPeriodEnd && activeSubscription.periodEnd
      ? new Date(activeSubscription.periodEnd).toLocaleDateString("en-US", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;
  //plan details from the subscription
  const planName = activeSubscription?.plan || "pro";
  const planPrice = "$4.99"; // Default price from the plan configuration, we can make dynamic later if needed
  const billingInterval = "month";
  return (
    <div>
      <div className="space-y-4">
        {/* Cancellation Notice */}
        {cancelDate && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Info className="h-4 w-4" />
            <span>Cancels {cancelDate}</span>
          </div>
        )}
        {/* Plan Details */}
        <div className="space-y-2">
          <h2 className="font-medium text-foreground text-xl">
            {planName.charAt(0).toUpperCase() + planName.slice(1)}
          </h2>
          <p className="text-foreground text-lg">
            {planPrice} per {billingInterval}
          </p>
        </div>

        {/* Cancellation Message */}
        {cancelDate && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <span>📅 Your subscription will be canceled on {cancelDate}.</span>
          </div>
        )}
        <Separator />
        {/* Payment Method */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-sm">Visa •••• 4242</span>
              </div>
              <SubscriptionManageButton
                variant="ghost"
                className="bg-transparent"
                size="sm"
                activeSubscription={activeSubscription}
              >
                <Edit className="h-3 w-3" />
              </SubscriptionManageButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
