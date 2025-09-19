import { db } from "@acme/db/client";
import { stripePrice, stripeProduct } from "@acme/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

/**
 * Handle Stripe webhook events to sync products and prices with the database
 */
export async function handleStripeWebhookEvent(event: Stripe.Event) {
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
}
