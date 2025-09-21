import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "../schema.js";
import { Plan } from "./plan.schema.js";

export const Subscription = pgTable(
  "subscription",
  {
    id: text("id").primaryKey(),
    referenceId: text("reference_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    planName: text("plan_name").references(() => Plan.name),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    seats: integer("seats"),
    status: text("status").default("incomplete"),
    periodStart: timestamp("period_start"),
    periodEnd: timestamp("period_end"),
    trialStart: timestamp("trial_start"),
    trialEnd: timestamp("trial_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end"),
    createdAt: timestamp("created_at")
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (t) => [
    index("subscription_status").on(t.status),
    index("subscription_stripe_customer_id").on(t.stripeCustomerId),
    index("subscription_stripe_subscription_id").on(t.stripeSubscriptionId),
  ],
);

export const SubscriptionRelations = relations(Subscription, ({ one }) => ({
  user: one(user, {
    fields: [Subscription.referenceId],
    references: [user.id],
  }),
  plan: one(Plan, {
    fields: [Subscription.planName],
    references: [Plan.name],
  }),
}));

export type Subscription = typeof Subscription.$inferSelect;

export type InsertSubscription = typeof Subscription.$inferInsert;
