import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./user.schema.js";

export const account = pgTable("account", {
	id: text("id").primaryKey(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	password: text("password"),
	scope: text("scope"),
	idToken: text("id_token"),
	accessToken: text("access_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at"),
	refreshToken: text("refresh_token"),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
});
export type Account = typeof account.$inferSelect;
