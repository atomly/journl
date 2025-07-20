import { sql } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { user } from "../auth/user.schema.js";

export const Page = pgTable("page", (t) => ({
	id: t.uuid().notNull().primaryKey().defaultRandom(),
	user_id: text()
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	title: t.text().notNull(),
	// Children array stores ordered list of child block IDs
	children: t.uuid().array().notNull().default([]),
	created_at: t
		.timestamp({ mode: "string", withTimezone: true })
		.defaultNow()
		.notNull(),
	updated_at: t
		.timestamp({ mode: "string", withTimezone: true })
		.defaultNow()
		.notNull()
		.$onUpdateFn(() => sql`now()`),
}));

export type Page = typeof Page.$inferSelect;
export const zInsertPage = createInsertSchema(Page, {
	title: z.string().min(1).max(255),
	children: z.array(z.string().uuid()).default([]),
}).omit({
	created_at: true,
	id: true,
	updated_at: true,
});

export const zUpdatePage = createInsertSchema(Page, {
	title: z.string().min(1).max(255),
	children: z.array(z.string().uuid()).optional(),
}).omit({
	created_at: true,
	id: true,
	updated_at: true,
	user_id: true,
});

export const zPage = createSelectSchema(Page);
