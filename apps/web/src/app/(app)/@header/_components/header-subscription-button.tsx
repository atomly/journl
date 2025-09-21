import { api } from "~/trpc/server";
import { HeaderSubscriptionButton as HeaderSubscriptionButtonClient } from "./header-subscription-button.client";

export async function HeaderSubscriptionButton() {
  const subscription = await api.subscription.getSubscription();

  const hasNonCancellingSubscription =
    subscription?.cancelAtPeriodEnd === false;

  if (hasNonCancellingSubscription) {
    return null;
  }

  const plan = await api.subscription.getProPlan();

  if (!plan) {
    console.error("No pro plan found");
    return null;
  }

  return (
    <HeaderSubscriptionButtonClient subscription={subscription} plan={plan} />
  );
}
