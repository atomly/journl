import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./user.schema.js";

export const session = pgTable("session", {
	createdAt: timestamp("created_at").notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	id: text("id").primaryKey(),
	ipAddress: text("ip_address"),
	token: text("token").notNull().unique(),
	updatedAt: timestamp("updated_at").notNull(),
	userAgent: text("user_agent"),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
});
export type Session = typeof session.$inferSelect;
