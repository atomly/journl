import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./user.schema.js";

export const account = pgTable("account", {
	accessToken: text("access_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at"),
	accountId: text("account_id").notNull(),
	createdAt: timestamp("created_at").notNull(),
	id: text("id").primaryKey(),
	idToken: text("id_token"),
	password: text("password"),
	providerId: text("provider_id").notNull(),
	refreshToken: text("refresh_token"),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
	scope: text("scope"),
	updatedAt: timestamp("updated_at").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
});
export type Account = typeof account.$inferSelect;
