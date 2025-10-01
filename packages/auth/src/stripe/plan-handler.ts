import { db } from "@acme/db/client";
import { type InsertPlan, Plan } from "@acme/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

async function upsertPlan(product: Stripe.Product) {
  const quota = Number(product.metadata.quota) || 0;

  const insertData: InsertPlan = {
    active: product.active,
    description: product.description,
    displayName: product.name,
    id: product.id,
    metadata: product.metadata,
    name: product.name.toLowerCase(),
    quota,
  };

  const updateData = {
    active: insertData.active,
    description: insertData.description,
    displayName: insertData.displayName,
    metadata: insertData.metadata,
    quota: insertData.quota,
    updated_at: new Date(),
  };

  return db.insert(Plan).values(insertData).onConflictDoUpdate({
    set: updateData,
    target: Plan.id,
  });
}

async function deletePlan(productId: string) {
  return db.update(Plan).set({ active: false }).where(eq(Plan.id, productId));
}

export async function handlePlanUpsertEvent(
  event: Stripe.ProductCreatedEvent | Stripe.ProductUpdatedEvent,
): Promise<void> {
  const product = event.data.object;
  await upsertPlan(product);
}

export async function handlePlanDeleteEvent(
  event: Stripe.ProductDeletedEvent,
): Promise<void> {
  const product = event.data.object;
  await deletePlan(product.id);
}
