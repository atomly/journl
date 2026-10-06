import { db } from "@acme/db/client";
import { type InsertPrice, Price } from "@acme/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { z } from "zod";

const zPriceBillingFields = z.object({
  interval: z.enum(["day", "week", "month", "year"]),
  type: z.enum(["one_time", "recurring"]),
});

async function upsertPrice(price: Stripe.Price) {
  if (!price.recurring) {
    throw new Error(
      `Price data is missing recurring info for price: ${price.id}`,
    );
  }

  // Stripe's extensible string enums may contain values our billing schema
  // does not support. Validate them instead of asserting database compatibility.
  const { interval, type } = zPriceBillingFields.parse({
    interval: price.recurring.interval,
    type: price.type,
  });

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
      interval,
      intervalCount: price.recurring.interval_count,
    },
    type,
    unitAmount: price.unit_amount ?? 0,
  };

  return db
    .insert(Price)
    .values(insertData)
    .onConflictDoUpdate({
      set: {
        active: insertData.active,
        currency: insertData.currency,
        lookupKey: insertData.lookupKey,
        metadata: insertData.metadata,
        nickname: insertData.nickname,
        recurring: insertData.recurring,
        type: insertData.type,
        unitAmount: insertData.unitAmount,
      },
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
