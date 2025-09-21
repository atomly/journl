import type Stripe from "stripe";

const SUBSCRIPTION_EVENTS = new Set<Stripe.Event.Type>([
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
]);

const PRODUCT_EVENTS = new Set<Stripe.Event.Type>([
  "product.created",
  "product.updated",
  "product.deleted",
]);

const PRICE_EVENTS = new Set<Stripe.Event.Type>([
  "price.created",
  "price.updated",
  "price.deleted",
]);

export const STRIPE_EVENTS = new Set([
  ...SUBSCRIPTION_EVENTS,
  ...PRODUCT_EVENTS,
  ...PRICE_EVENTS,
]);
