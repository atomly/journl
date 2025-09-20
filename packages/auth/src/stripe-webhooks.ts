import { db } from "@acme/db/client";
import { stripePrice, stripeProduct, subscription } from "@acme/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { stripeClient } from "./stripe-client";

export async function syncStripeDataToDb(customerId: string): Promise<void> {
  console.log(`[STRIPE HOOK] Syncing data for customer: ${customerId}`);

  // Fetch latest subscription data from Stripe
  const subscriptions = await stripeClient.subscriptions.list({
    customer: customerId,
    expand: ["data.default_payment_method"],
    limit: 1,
    status: "all",
  });

  if (subscriptions.data.length === 0) {
    console.log(
      `[STRIPE HOOK] No subscriptions found for customer: ${customerId}`,
    );

    // For deleted subscriptions, we need to mark existing ones as canceled
    // Update all subscriptions for this customer to canceled status
    await db
      .update(subscription)
      .set({
        cancelAtPeriodEnd: false,
        status: "canceled",
      })
      .where(eq(subscription.stripeCustomerId, customerId));

    console.log(
      `[STRIPE HOOK] Marked subscriptions as canceled for customer: ${customerId}`,
    );
    return;
  }

  const stripeSubscription = subscriptions.data[0];
  if (!stripeSubscription) {
    console.log(
      `[STRIPE HOOK] No subscription data found for customer: ${customerId}`,
    );
    return;
  }

  const paymentMethod =
    stripeSubscription.default_payment_method as Stripe.PaymentMethod | null;

  // Store complete subscription state - use type assertion for webhook data
  const subscriptionData = {
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    cardBrand: paymentMethod?.card?.brand || null,
    cardExpMonth: paymentMethod?.card?.exp_month || null,
    cardExpYear: paymentMethod?.card?.exp_year || null,
    cardLast4: paymentMethod?.card?.last4 || null,
    status: stripeSubscription.status,
  };

  // Update the subscription in the database using stripeSubscriptionId
  await db
    .update(subscription)
    .set(subscriptionData)
    .where(eq(subscription.stripeSubscriptionId, stripeSubscription.id));

  console.log(
    `[STRIPE HOOK] Successfully synced subscription: ${stripeSubscription.id}`,
  );
}

/**
 * Events that affect subscription state and should trigger a sync
 */
const allowedEvents: Stripe.Event.Type[] = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "customer.subscription.pending_update_applied",
  "customer.subscription.pending_update_expired",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "invoice.upcoming",
  "invoice.marked_uncollectible",
  "invoice.payment_succeeded",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
];

/**
 * Process a Stripe event by syncing customer data
 */
async function processEvent(event: Stripe.Event): Promise<void> {
  // Skip processing if the event isn't one we're tracking
  if (!allowedEvents.includes(event.type)) {
    console.log(`[STRIPE HOOK] Skipping untracked event: ${event.type}`);
    return;
  }

  // All the events we track have a customerId
  const eventData = event.data.object as { customer?: string };
  const customerId = eventData.customer;

  // Handle checkout.session.completed which has customer in a different location
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.customer && typeof session.customer === "string") {
      await syncStripeDataToDb(session.customer);
      return;
    }
  }

  // This helps make it typesafe and also lets us know if our assumption is wrong
  if (typeof customerId !== "string") {
    throw new Error(
      `[STRIPE HOOK] Customer ID isn't string. Event type: ${event.type}`,
    );
  }

  await syncStripeDataToDb(customerId);
}

export async function handleStripeWebhookEvent(event: Stripe.Event) {
  console.log(`[STRIPE HOOK] Processing Stripe webhook: ${event.type}`, {
    eventId: event.id,
  });

  try {
    // Handle subscription-related events with the unified sync approach
    await processEvent(event);

    // Handle product and price events separately since they don't relate to customer subscriptions
    switch (event.type) {
      case "product.created":
      case "product.updated": {
        const product = event.data.object as Stripe.Product;
        await db
          .insert(stripeProduct)
          .values({
            active: product.active,
            description: product.description || null,
            id: product.id,
            metadata: product.metadata,
            name: product.name,
            updated_at: new Date(),
          })
          .onConflictDoUpdate({
            set: {
              active: product.active,
              description: product.description || null,
              metadata: product.metadata,
              name: product.name,
              updated_at: new Date(),
            },
            target: stripeProduct.id,
          });
        break;
      }

      case "product.deleted": {
        const product = event.data.object as Stripe.Product;
        await db
          .update(stripeProduct)
          .set({ active: false, updated_at: new Date() })
          .where(eq(stripeProduct.id, product.id));
        break;
      }

      case "price.created":
      case "price.updated": {
        const price = event.data.object as Stripe.Price;
        await db
          .insert(stripePrice)
          .values({
            active: price.active,
            currency: price.currency,
            id: price.id,
            lookup_key: price.lookup_key || null,
            metadata: price.metadata,
            nickname: price.nickname || null,
            product_id: price.product as string,
            recurring: price.recurring
              ? {
                  interval: price.recurring.interval,
                  intervalCount: price.recurring.interval_count,
                }
              : null,
            type: price.type,
            unit_amount: price.unit_amount,
            updated_at: new Date(),
          })
          .onConflictDoUpdate({
            set: {
              active: price.active,
              currency: price.currency,
              lookup_key: price.lookup_key || null,
              metadata: price.metadata,
              nickname: price.nickname || null,
              recurring: price.recurring
                ? {
                    interval: price.recurring.interval,
                    intervalCount: price.recurring.interval_count,
                  }
                : null,
              type: price.type,
              unit_amount: price.unit_amount,
              updated_at: new Date(),
            },
            target: stripePrice.id,
          });
        break;
      }

      case "price.deleted": {
        const price = event.data.object as Stripe.Price;
        await db
          .update(stripePrice)
          .set({ active: false, updated_at: new Date() })
          .where(eq(stripePrice.id, price.id));
        break;
      }
    }
  } catch (error) {
    console.error(
      `[STRIPE HOOK] Error processing webhook ${event.type}:`,
      error,
    );
    throw error; // Re-throw to let Better Auth handle the error response
  }
}
