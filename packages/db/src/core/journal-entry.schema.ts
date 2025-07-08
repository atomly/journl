import { sql } from "drizzle-orm";
import { pgTable, text, unique } from "drizzle-orm/pg-core";
import { user } from "../auth/user.schema.js";

export const JournalEntry = pgTable(
	"journal_entry",
	(t) => ({
		id: t.uuid().notNull().primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		content: t.text().notNull(),
		date: t.date({ mode: "string" }).notNull(),
		createdAt: t
			.timestamp({ mode: "string", withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: t
			.timestamp({ mode: "string", withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdateFn(() => sql`now()`),
	}),
	(table) => [
		// Enforce uniqueness: one journal entry per user per day
		unique("unique_journal_entry_user_date").on(table.userId, table.date),
	],
);

export type JournalEntry = typeof JournalEntry.$inferSelect;
