import { relations } from "drizzle-orm";
import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { stripePrice } from "./stripe-price.schema.js";

export const stripeProduct = pgTable("stripe_products", {
  id: text("id").primaryKey(), // Stripe product ID
  name: text("name").notNull(),
  description: text("description"),
  active: boolean("active").default(true).notNull(),
  metadata:
    jsonb("metadata").$type<Record<string, string | number | boolean>>(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const stripeProductsRelations = relations(stripeProduct, ({ many }) => ({
  prices: many(stripePrice),
}));
