import type Stripe from "stripe";
import { STRIPE_EVENTS } from "./stripe/events";
import {
  handlePlanDeleteEvent,
  handlePlanUpsertEvent,
} from "./stripe/plan-handler";
import {
  handlePriceDeleteEvent,
  handlePriceUpsertEvent,
} from "./stripe/price-handler";
import { handleSubscriptionEvents } from "./stripe/subscription-handler";

export async function handleStripeWebhookEvent(event: Stripe.Event) {
  if (!STRIPE_EVENTS.has(event.type)) {
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
      case "customer.subscription.pending_update_applied":
      case "customer.subscription.pending_update_expired":
      case "invoice.paid":
      case "invoice.payment_failed":
      case "invoice.payment_action_required":
      case "invoice.upcoming":
      case "invoice.marked_uncollectible":
      case "invoice.payment_succeeded":
      case "payment_intent.succeeded":
      case "payment_intent.payment_failed":
      case "payment_intent.canceled":
        await handleSubscriptionEvents(event);
        break;

      case "product.created":
      case "product.updated":
        await handlePlanUpsertEvent(event);
        break;

      case "product.deleted":
        await handlePlanDeleteEvent(event);
        break;

      case "price.created":
      case "price.updated":
        await handlePriceUpsertEvent(event);
        break;

      case "price.deleted":
        await handlePriceDeleteEvent(event);
        break;
    }
  } catch (error) {
    console.error(`Error processing webhook ${event.type}:`, error);
    throw error;
  }
}
