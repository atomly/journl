import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const verification = pgTable("verification", {
	createdAt: timestamp("created_at").$defaultFn(
		() => /* @__PURE__ */ new Date(),
	),
	expiresAt: timestamp("expires_at").notNull(),
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	updatedAt: timestamp("updated_at").$defaultFn(
		() => /* @__PURE__ */ new Date(),
	),
	value: text("value").notNull(),
});
export type Verification = typeof verification.$inferSelect;
