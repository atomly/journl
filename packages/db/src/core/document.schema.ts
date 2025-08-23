import { sql } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { user } from "../auth/user.schema.js";

export const Document = pgTable("document", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  user_id: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
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

export type Document = typeof Document.$inferSelect;

export const zInsertDocument = createInsertSchema(Document).pick({
  user_id: true,
});

export const zDocument = createSelectSchema(Document);
