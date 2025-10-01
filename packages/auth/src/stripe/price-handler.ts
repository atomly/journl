import { db } from "@acme/db/client";
import { type InsertPrice, Price } from "@acme/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

async function upsertPrice(price: Stripe.Price) {
  if (!price.recurring) {
    throw new Error(
      `Price data is missing recurring info for price: ${price.id}`,
    );
  }

  const planId =
    typeof price.product === "string" ? price.product : price.product.id;

  const insertData: InsertPrice = {
    active: price.active,
    currency: price.currency,
    id: price.id,
    lookupKey: price.lookup_key,
    metadata: price.metadata,
    nickname: price.nickname,
    planId,
    recurring: {
      interval: price.recurring.interval,
      intervalCount: price.recurring.interval_count,
    },
    type: price.type,
    unitAmount: price.unit_amount ?? 0,
  };

  // For updates, exclude auto-generated timestamp fields and planId (shouldn't change)
  const updateData = {
    active: insertData.active,
    currency: insertData.currency,
    lookupKey: insertData.lookupKey,
    metadata: insertData.metadata,
    nickname: insertData.nickname,
    recurring: insertData.recurring,
    type: insertData.type,
    unitAmount: insertData.unitAmount,
    updatedAt: new Date(),
  };

  return db.insert(Price).values(insertData).onConflictDoUpdate({
    set: updateData,
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
