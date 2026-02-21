import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { TEXT_LIMITS } from "../constants/resource-limits.ts";
import { Price } from "./price.schema.ts";

export const Plan = pgTable(
  "plan",
  {
    id: text("id").primaryKey(),
    name: varchar("name", { length: TEXT_LIMITS.PLAN_NAME }).notNull().unique(),
    displayName: varchar("display_name", {
      length: TEXT_LIMITS.PLAN_NAME,
    }).notNull(),
    description: varchar("description", { length: TEXT_LIMITS.DESCRIPTION }),
    active: boolean("active").default(true).notNull(),
    quota: integer("quota").notNull(),
    metadata: jsonb("metadata").$type<Record<string, string>>().default({}),
    created_at: timestamp("created_at")
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updated_at: timestamp("updated_at")
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .$onUpdateFn(() => sql`now()`)
      .notNull(),
  },
  (t) => [index("plan_name_lower").on(sql`lower(${t.name})`)],
);

export const PlanRelations = relations(Plan, ({ one }) => ({
  price: one(Price, {
    fields: [Plan.id],
    references: [Price.planId],
  }),
}));

export type Plan = typeof Plan.$inferSelect;

export type InsertPlan = typeof Plan.$inferInsert;
