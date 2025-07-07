import { sql } from "drizzle-orm";
import { pgTable, text, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { user } from "../auth/user.schema.js";

export const JournalEntry = pgTable(
	"journal_entry",
	(t) => ({
		id: t.uuid().notNull().primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		content: t.text().notNull(),
		date: t
			.date({ mode: "date" })
			.notNull()
			.$defaultFn(() => new Date()),
		createdAt: t.timestamp().defaultNow().notNull(),
		updatedAt: t
			.timestamp({ mode: "date", withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdateFn(() => sql`now()`),
	}),
	(table) => ({
		// Enforce uniqueness: one journal entry per user per day
		uniqueUserDate: unique().on(table.userId, table.date),
	}),
);

export type JournalEntry = typeof JournalEntry.$inferSelect;

export const InsertJournalEntry = createInsertSchema(JournalEntry, {
	content: z.string().min(1).max(10000),
	date: z.date().optional(),
}).omit({
	createdAt: true,
	id: true,
	updatedAt: true,
	userId: true,
});

export const UpdateJournalEntry = createInsertSchema(JournalEntry, {
	content: z.string().min(1).max(10000),
}).omit({
	createdAt: true,
	id: true,
	updatedAt: true,
	userId: true,
	date: true,
});
