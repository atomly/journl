import { relations, sql } from "drizzle-orm";
import { index, pgTable, text, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { user } from "../auth/user.schema.ts";
import { Plan } from "../billing/plan.schema.ts";
import { Subscription } from "../billing/subscription.schema.ts";
import { UsageAggregate } from "./usage-aggregate.schema.ts";

export const UsagePeriod = pgTable(
  "usage_period",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    user_id: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    plan_id: text().references(() => Plan.id),
    subscription_id: text().references(() => Subscription.id),
    period_start: t.timestamp({ mode: "string", withTimezone: true }).notNull(),
    period_end: t.timestamp({ mode: "string", withTimezone: true }).notNull(),
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

export const UsagePeriodRelations = relations(UsagePeriod, ({ one }) => ({
  plan: one(Plan, {
    fields: [UsagePeriod.plan_id],
    references: [Plan.id],
  }),
  subscription: one(Subscription, {
    fields: [UsagePeriod.subscription_id],
    references: [Subscription.id],
  }),
  user: one(user, {
    fields: [UsagePeriod.user_id],
    references: [user.id],
  }),
  usageAggregate: one(UsageAggregate, {
    fields: [UsagePeriod.id, UsagePeriod.user_id],
    references: [UsageAggregate.usage_period_id, UsageAggregate.user_id],
  }),
}));

export type UsagePeriod = typeof UsagePeriod.$inferSelect;

export const zInsertUsagePeriod = createInsertSchema(UsagePeriod).omit({
  created_at: true,
  id: true,
  updated_at: true,
});

export const zUsagePeriod = createSelectSchema(UsagePeriod);
