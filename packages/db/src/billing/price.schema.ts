import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { Plan } from "./plan.schema.js";

export const Price = pgTable(
  "price",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .unique()
      .references(() => Plan.id),
    nickname: text("nickname"),
    currency: text("currency").notNull(),
    unitAmount: integer("unit_amount").notNull(),
    recurring: jsonb("recurring").notNull().$type<{
      interval: "day" | "week" | "month" | "year";
      intervalCount: number;
    }>(),
    type: text("type", { enum: ["one_time", "recurring"] }).notNull(),
    active: boolean("active").default(true).notNull(),
    lookupKey: text("lookup_key"),
    createdAt: timestamp("created_at")
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (t) => [unique("price_plan_id_active").on(t.planId, t.active)],
);

export const PriceRelations = relations(Price, ({ one }) => ({
  plan: one(Plan, {
    fields: [Price.planId],
    references: [Plan.id],
  }),
}));

export type Price = typeof Price.$inferSelect;

export type InsertPrice = typeof Price.$inferInsert;
