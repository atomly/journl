import { relations, sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { TEXT_LIMITS } from "../constants/resource-limits.js";
import { Plan } from "./plan.schema.js";

export const Price = pgTable(
  "price",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .unique()
      .references(() => Plan.id),
    nickname: varchar("nickname", { length: TEXT_LIMITS.PLAN_NAME }),
    currency: varchar("currency", { length: TEXT_LIMITS.CURRENCY }).notNull(),
    unitAmount: integer("unit_amount").notNull(),
    recurring: jsonb("recurring").notNull().$type<{
      interval: "day" | "week" | "month" | "year";
      intervalCount: number;
    }>(),
    type: varchar("type", {
      length: 20,
      enum: ["one_time", "recurring"],
    }).notNull(),
    active: boolean("active").default(true).notNull(),
    lookupKey: varchar("lookup_key", { length: TEXT_LIMITS.LOOKUP_KEY }),
    metadata: jsonb("metadata").$type<Record<string, string>>().default({}),
    createdAt: timestamp("created_at")
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .$onUpdateFn(() => sql`now()`)
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
