import { db } from "@acme/db/client";
import { type InsertPrice, Price } from "@acme/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

async function upsertPrice(price: Stripe.Price) {
  if (!price.unit_amount || !price.recurring) {
    throw new Error(`Price data is missing for price: ${price.id}`);
  }

  const data: InsertPrice = {
    active: price.active,
    currency: price.currency,
    id: price.id,
    lookupKey: price.lookup_key,
    nickname: price.nickname,
    planId:
      typeof price.product === "string" ? price.product : price.product.id,
    recurring: {
      interval: price.recurring.interval,
      intervalCount: price.recurring.interval_count,
    },
    type: price.type,
    unitAmount: price.unit_amount,
  };

  return db.insert(Price).values(data).onConflictDoUpdate({
    set: data,
    target: Price.id,
  });
}

async function deletePrice(priceId: string) {
  return db.update(Price).set({ active: false }).where(eq(Price.id, priceId));
}

export async function handlePriceUpsertEvent(
  event: Stripe.PriceCreatedEvent | Stripe.PriceUpdatedEvent,
): Promise<void> {
  const price = event.data.object;
  await upsertPrice(price);
}

export async function handlePriceDeleteEvent(
  event: Stripe.PriceDeletedEvent,
): Promise<void> {
  const price = event.data.object;
  await deletePrice(price.id);
}
