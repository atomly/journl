import { index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { user } from "../auth/user.schema.js";
import { Plan } from "../billing/plan.schema.js";
import { Subscription } from "../billing/subscription.schema.js";

export const UsagePeriod = pgTable(
  "usage_period",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    user_id: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    plan_id: text().references(() => Plan.id),
    subscription_id: text().references(() => Subscription.id),
    period_start: timestamp({ withTimezone: true }).notNull(),
    period_end: timestamp({ withTimezone: true }).notNull(),
    created_at: timestamp().defaultNow(),
    updated_at: timestamp()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  }),
  (t) => [
    // Prevent duplicate periods for the same user and timeframe
    unique("usage_period_user_period").on(
      t.user_id,
      t.period_start,
      t.period_end,
    ),
    // Optimize queries by user and date ranges
    index("usage_period_user_dates").on(
      t.user_id,
      t.period_start,
      t.period_end,
    ),
    // Optimize subscription-based queries
    index("usage_period_subscription").on(t.subscription_id),
  ],
);

export type UsagePeriod = typeof UsagePeriod.$inferSelect;

export const zInsertUsagePeriod = createInsertSchema(UsagePeriod).omit({
  created_at: true,
  id: true,
  updated_at: true,
});

export const zUsagePeriod = createSelectSchema(UsagePeriod);
