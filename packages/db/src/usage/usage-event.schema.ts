import { sql } from "drizzle-orm";
import {
  check,
  decimal,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { JSONB_LIMITS, TEXT_LIMITS } from "../constants/resource-limits.js";
import { user } from "../schema.js";

export const UsageEventStatus = pgEnum("usage_event_status", [
  "pending",
  "processed",
  "failed",
]);

export const UsageEvent = pgTable(
  "usage_event",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    user_id: text()
      .notNull()
      .references(() => user.id),
    model_id: varchar("model_id", { length: TEXT_LIMITS.MODEL_ID }).notNull(),
    model_provider: varchar("model_provider", {
      length: TEXT_LIMITS.MODEL_PROVIDER,
    }).notNull(),
    metadata: jsonb(),
    metrics: jsonb()
      .$type<
        {
          unit: string;
          quantity: number;
        }[]
      >()
      .notNull(),
    status: UsageEventStatus().notNull().default("pending"),
    total_cost: decimal("total_cost", { precision: 10, scale: 6 })
      .notNull()
      .default("0"),
    created_at: timestamp().defaultNow(),
    updated_at: timestamp()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  }),
  (t) => [
    // Resource protection constraints for JSONB fields
    check(
      "usage_metadata_size",
      sql`${t.metadata} IS NULL OR length(${t.metadata}::text) <= ${JSONB_LIMITS.EMBEDDING_TASK_METADATA}`,
    ),
    check(
      "usage_metrics_size",
      sql`length(${t.metrics}::text) <= ${JSONB_LIMITS.EMBEDDING_TASK_METADATA}`,
    ),
  ],
);

export type UsageEvent = typeof UsageEvent.$inferSelect;

export const zInsertUsageEvent = createInsertSchema(UsageEvent).omit({
  created_at: true,
  id: true,
  updated_at: true,
});

export const zUsageEvent = createSelectSchema(UsageEvent);

// Webhook-compatible schema that accepts string timestamps and handles decimal fields
export const zUsageEventWebhook = zUsageEvent.extend({
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  total_cost: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => (val !== undefined ? String(val) : "0")),
});
