import {
  decimal,
  index,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { user } from "../auth/user.schema.js";
import { UsagePeriod } from "./usage-period.schema.js";

export const UsageAggregate = pgTable(
  "usage_aggregate",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    user_id: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    usage_period_id: t
      .uuid()
      .notNull()
      .references(() => UsagePeriod.id, { onDelete: "cascade" }),

    // Aggregated cost for the entire period
    total_cost_usd: decimal("total_cost_usd", { precision: 10, scale: 6 })
      .notNull()
      .default("0"),

    created_at: timestamp().defaultNow(),
    updated_at: timestamp()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  }),
  (t) => [
    // One aggregate per user per period
    unique("usage_aggregate_user_period_unique").on(
      t.user_id,
      t.usage_period_id,
    ),
    // Optimize queries by user and period
    index("usage_aggregate_user_period").on(t.user_id, t.usage_period_id),
  ],
);

export type UsageAggregate = typeof UsageAggregate.$inferSelect;

export const zInsertUsageAggregate = createInsertSchema(UsageAggregate).omit({
  created_at: true,
  id: true,
  updated_at: true,
});

export const zUsageAggregate = createSelectSchema(UsageAggregate);
