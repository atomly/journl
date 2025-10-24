import { db } from "@acme/db/client";
import { Subscription } from "@acme/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { stripeClient } from "../stripe-client";
import { createUsagePeriodForSubscription } from "../usage/usage-period-lifecycle";

export async function handleSubscriptionEvents(
  event:
    | Stripe.CheckoutSessionCompletedEvent
    | Stripe.CustomerSubscriptionCreatedEvent
    | Stripe.CustomerSubscriptionDeletedEvent
    | Stripe.CustomerSubscriptionPausedEvent
    | Stripe.CustomerSubscriptionPendingUpdateAppliedEvent
    | Stripe.CustomerSubscriptionPendingUpdateExpiredEvent
    | Stripe.CustomerSubscriptionResumedEvent
    | Stripe.CustomerSubscriptionUpdatedEvent
    | Stripe.InvoicePaidEvent
    | Stripe.InvoiceMarkedUncollectibleEvent
    | Stripe.InvoicePaymentActionRequiredEvent
    | Stripe.InvoicePaymentFailedEvent
    | Stripe.InvoicePaymentSucceededEvent
    | Stripe.InvoiceUpcomingEvent
    | Stripe.PaymentIntentCanceledEvent
    | Stripe.PaymentIntentPaymentFailedEvent
    | Stripe.PaymentIntentSucceededEvent,
): Promise<void> {
  if (!("customer" in event.data.object)) {
    throw new Error(`Customer ID missing or invalid for event: ${event.type}`);
  }

  let { customer: customerId } = event.data.object;

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (typeof session.customer === "string") {
      customerId = session.customer;
    }
  }

  if (typeof customerId !== "string") {
    throw new Error(`Customer ID missing or invalid for event: ${event.type}`);
  }

  const subscriptions = await stripeClient.subscriptions.list({
    customer: customerId,
    expand: ["data.default_payment_method"],
    limit: 1,
    status: "all",
  });

  if (subscriptions.data.length === 0) {
    await db
      .update(Subscription)
      .set({
        cancelAtPeriodEnd: false,
        status: "canceled",
      })
      .where(eq(Subscription.stripeCustomerId, customerId));
    return;
  }

  const [stripeSubscription] = subscriptions.data;
  if (!stripeSubscription) return;

  const firstItem = stripeSubscription.items.data[0];
  if (!firstItem) {
    console.error("No subscription items found");
    return;
  }

  const periodStart = firstItem.current_period_start
    ? new Date(firstItem.current_period_start * 1000)
    : undefined;
  const periodEnd = firstItem.current_period_end
    ? new Date(firstItem.current_period_end * 1000)
    : undefined;

  await db
    .update(Subscription)
    .set({
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      periodEnd,
      periodStart,
      status: stripeSubscription.status,
    })
    .where(eq(Subscription.stripeSubscriptionId, stripeSubscription.id));

  const updatedSubscription = await db.query.Subscription.findFirst({
    where: eq(Subscription.stripeSubscriptionId, stripeSubscription.id),
  });

  if (updatedSubscription && updatedSubscription.status === "active") {
    await createUsagePeriodForSubscription(updatedSubscription);
  }
}
