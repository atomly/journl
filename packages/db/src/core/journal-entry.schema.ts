import { sql } from "drizzle-orm";
import { pgTable, text, unique } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import z from "zod/v4";
import { user } from "../auth/user.schema.js";

export const JournalEntry = pgTable(
	"journal_entry",
	(t) => ({
		id: t.uuid().notNull().primaryKey().defaultRandom(),
		user_id: text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		// Content stores the journal entry text content
		content: text().notNull(),
		date: t.date({ mode: "string" }).notNull(),
		created_at: t
			.timestamp({ mode: "string", withTimezone: true })
			.defaultNow()
			.notNull(),
		updated_at: t
			.timestamp({ mode: "string", withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdateFn(() => sql`now()`),
	}),
	(table) => [
		// Enforce uniqueness: one journal entry per user per day
		unique("unique_journal_entry_user_date").on(table.user_id, table.date),
	],
);

export type JournalEntry = typeof JournalEntry.$inferSelect;

export const zJournalEntry = createSelectSchema(JournalEntry);

export const zJournalEntryDate = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/)
	.describe("The date to fetch the journal entry for in YYYY-MM-DD format.");
