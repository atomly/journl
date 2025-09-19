import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { stripeProduct } from "./stripe-product.schema.js";

export const stripePrice = pgTable("stripe_price", {
  id: text("id").primaryKey(), // Stripe price ID
  product_id: text("product_id")
    .notNull()
    .references(() => stripeProduct.id, { onDelete: "cascade" }),
  nickname: text("nickname"),
  currency: text("currency").notNull(),
  unit_amount: integer("unit_amount"), // Amount in smallest currency unit (e.g., cents)
  recurring: jsonb("recurring").$type<{
    interval: "day" | "week" | "month" | "year";
    intervalCount: number;
  }>(),
  type: text("type", { enum: ["one_time", "recurring"] }).notNull(),
  active: boolean("active").default(true).notNull(),
  lookup_key: text("lookup_key"),
  metadata:
    jsonb("metadata").$type<Record<string, string | number | boolean>>(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const stripePricesRelations = relations(stripePrice, ({ one }) => ({
  product: one(stripeProduct, {
    fields: [stripePrice.product_id],
    references: [stripeProduct.id],
  }),
}));
