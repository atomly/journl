import { sql } from "drizzle-orm";
import { decimal, index, pgTable, unique, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { TEXT_LIMITS } from "../constants/resource-limits.ts";

export const ModelPricing = pgTable(
  "model_pricing",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    model_id: varchar("model_id", { length: TEXT_LIMITS.MODEL_ID }).notNull(),
    model_provider: varchar("model_provider", {
      length: TEXT_LIMITS.MODEL_PROVIDER,
    }).notNull(),
    unit_type: varchar("unit_type", { length: 50 }).notNull(), // See usage-unit.ts for supported unit values
    price_per_unit: decimal("price_per_unit", {
      precision: 12,
      scale: 8,
    }).notNull(), // High precision for token pricing (e.g., $0.00000150 per token)
    effective_date: t
      .timestamp({ mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
    created_at: t
      .timestamp({ mode: "string", withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: t
      .timestamp({ mode: "string", withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => sql`now()`),
  }),
  (t) => [
    // Ensure unique pricing per model, provider, unit type, and effective date
    unique("model_pricing_unique").on(
      t.model_id,
      t.model_provider,
      t.unit_type,
      t.effective_date,
    ),
    // Optimize queries by model and provider
    index("model_pricing_model_provider").on(t.model_id, t.model_provider),
    // Optimize queries by effective date for getting current pricing
    index("model_pricing_effective_date").on(t.effective_date),
  ],
);

export type ModelPricing = typeof ModelPricing.$inferSelect;

export const zInsertModelPricing = createInsertSchema(ModelPricing).omit({
  created_at: true,
  id: true,
  updated_at: true,
});

export const zModelPricing = createSelectSchema(ModelPricing);
