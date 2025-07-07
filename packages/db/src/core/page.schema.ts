import { sql } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { user } from "../auth/user.schema.js";

export const Page = pgTable("page", (t) => ({
	id: t.uuid().notNull().primaryKey().defaultRandom(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	title: t.text().notNull(),
	content: t.text().notNull(),
	createdAt: t.timestamp().defaultNow().notNull(),
	updatedAt: t
		.timestamp({ mode: "date", withTimezone: true })
		.defaultNow()
		.notNull()
		.$onUpdateFn(() => sql`now()`),
}));

export type Page = typeof Page.$inferSelect;

export const InsertPage = createInsertSchema(Page, {
	title: z.string().min(1).max(255),
	content: z.string().min(1).max(50000),
}).omit({
	createdAt: true,
	id: true,
	updatedAt: true,
});

export const UpdatePage = createInsertSchema(Page, {
	title: z.string().min(1).max(255),
	content: z.string().min(1).max(50000),
}).omit({
	createdAt: true,
	id: true,
	updatedAt: true,
	userId: true,
});
