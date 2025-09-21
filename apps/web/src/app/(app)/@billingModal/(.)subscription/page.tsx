import { redirect } from "next/navigation";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { api } from "~/trpc/server";
import { SubscriptionView } from "../../../(dashboard)/subscription/_components/subscription-view";
import { SubscriptionModal } from "./_components/subscription-modal";

export default async function SubscriptionBillingModalPage() {
  const subscription = await api.subscription.getSubscription();
  if (!subscription) {
    return redirect("/journal");
  }

  return (
    <SubscriptionModal>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="capitalize">Plan Summary</DialogTitle>
        </DialogHeader>
        <SubscriptionView subscription={subscription} />
      </DialogContent>
    </SubscriptionModal>
  );
}
