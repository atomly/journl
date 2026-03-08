import { db } from "@acme/db/client";
import { Subscription } from "@acme/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { stripeClient } from "../stripe-client";
import { createUsagePeriodForSubscription } from "../usage/usage-period-lifecycle";

export async function handleSubscriptionEvents(
  event: Stripe.Event,
): Promise<void> {
  const customerId = getCustomerIdFromEvent(event);

  if (!customerId) {
    console.warn(`No customer id found for event: ${event.type}`);
    return;
  }

  const subscriptionId = getSubscriptionIdFromEvent(event);
  const canFallbackToLatestSubscription =
    shouldFallbackToLatestSubscription(event);

  if (!subscriptionId && !canFallbackToLatestSubscription) {
    console.warn(`No subscription id found for event: ${event.type}`);
    return;
  }

  const stripeSubscription = await retrieveStripeSubscription({
    canFallbackToLatestSubscription,
    customerId,
    subscriptionId,
  });

  if (!stripeSubscription) {
    await markSubscriptionsCanceledByCustomerId(customerId);
    return;
  }

  const firstItem = stripeSubscription.items.data[0];
  const currentPeriodStart = firstItem?.current_period_start;
  const currentPeriodEnd = firstItem?.current_period_end;

  const periodStart = currentPeriodStart
    ? new Date(currentPeriodStart * 1000)
    : undefined;
  const periodEnd = currentPeriodEnd
    ? new Date(currentPeriodEnd * 1000)
    : undefined;

  const [updatedSubscription] = await db
    .update(Subscription)
    .set({
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      periodEnd,
      periodStart,
      status: stripeSubscription.status,
    })
    .where(eq(Subscription.stripeSubscriptionId, stripeSubscription.id))
    .returning();

  if (updatedSubscription && isPaidUsageStatus(updatedSubscription.status)) {
    await createUsagePeriodForSubscription(updatedSubscription);
  }
}

function getCustomerIdFromEvent(event: Stripe.Event): string | null {
  const maybeCustomer = (event.data.object as { customer?: StripeId }).customer;

  return getStripeId(maybeCustomer);
}

function getSubscriptionIdFromEvent(event: Stripe.Event): string | null {
  if (event.type.startsWith("customer.subscription.")) {
    return (event.data.object as Stripe.Subscription).id;
  }

  if (event.type.startsWith("invoice.")) {
    const invoice = event.data.object as Stripe.Invoice;
    return getStripeId(
      invoice.parent?.subscription_details?.subscription as StripeId,
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    return getStripeId(session.subscription as StripeId);
  }

  return null;
}

type StripeId = string | { id: string } | null | undefined;

function getStripeId(value: StripeId): string | null {
  if (!value) {
    return null;
  }

  return typeof value === "string" ? value : value.id;
}

async function retrieveStripeSubscription(input: {
  canFallbackToLatestSubscription: boolean;
  customerId: string;
  subscriptionId: string | null;
}) {
  if (input.subscriptionId) {
    try {
      return await stripeClient.subscriptions.retrieve(input.subscriptionId, {
        expand: ["default_payment_method"],
      });
    } catch (error) {
      if (!isStripeNotFoundError(error)) {
        throw error;
      }
    }
  }

  if (!input.canFallbackToLatestSubscription) {
    return null;
  }

  const subscriptions = await stripeClient.subscriptions.list({
    customer: input.customerId,
    expand: ["data.default_payment_method"],
    limit: 1,
    status: "all",
  });

  return subscriptions.data[0] ?? null;
}

async function markSubscriptionsCanceledByCustomerId(customerId: string) {
  await db
    .update(Subscription)
    .set({
      cancelAtPeriodEnd: false,
      status: "canceled",
    })
    .where(eq(Subscription.stripeCustomerId, customerId));
}

function isStripeNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    (error as { statusCode?: number }).statusCode === 404
  );
}

function shouldFallbackToLatestSubscription(event: Stripe.Event) {
  return event.type === "checkout.session.completed";
}

function isPaidUsageStatus(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}
