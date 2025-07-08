import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./user.schema.js";

export const session = pgTable("session", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	token: text("token").notNull().unique(),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
});
export type Session = typeof session.$inferSelect;
