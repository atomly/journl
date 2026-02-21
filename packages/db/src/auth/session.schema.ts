import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { TEXT_LIMITS } from "../constants/resource-limits.ts";
import { user } from "./user.schema.ts";

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: varchar("ip_address", { length: TEXT_LIMITS.IP_ADDRESS }),
  userAgent: varchar("user_agent", { length: TEXT_LIMITS.USER_AGENT }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  activeOrganizationId: varchar("active_organization_id", {
    length: TEXT_LIMITS.EMAIL,
  }),
});

export type Session = typeof session.$inferSelect;
