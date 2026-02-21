import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { TEXT_LIMITS } from "../constants/resource-limits.ts";
import { user } from "./user.schema.ts";

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: TEXT_LIMITS.NAME }).notNull(),
  slug: varchar("slug", { length: TEXT_LIMITS.SLUG }).unique(),
  logo: varchar("logo", { length: TEXT_LIMITS.URL }),
  createdAt: timestamp("created_at").notNull(),
  metadata: varchar("metadata", { length: TEXT_LIMITS.URL }),
});

export const member = pgTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: varchar("role", { length: TEXT_LIMITS.STATUS })
    .default("member")
    .notNull(),
  createdAt: timestamp("created_at").notNull(),
});

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: varchar("email", { length: TEXT_LIMITS.EMAIL }).notNull(),
  role: varchar("role", { length: TEXT_LIMITS.STATUS }),
  status: varchar("status", { length: TEXT_LIMITS.STATUS })
    .default("pending")
    .notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});
