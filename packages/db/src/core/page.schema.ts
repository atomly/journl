import { sql } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";
import { user } from "../auth/user.schema.js";

export const Page = pgTable("page", (t) => ({
	id: t.uuid().notNull().primaryKey().defaultRandom(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	title: t.text().notNull(),
	content: t.text().notNull().default(""),
	createdAt: t
		.timestamp({ mode: "string", withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: t
		.timestamp({ mode: "string", withTimezone: true })
		.defaultNow()
		.notNull()
		.$onUpdateFn(() => sql`now()`),
}));

export type Page = typeof Page.$inferSelect;
