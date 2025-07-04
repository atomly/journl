import { sql } from "drizzle-orm";
import { pgTable } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const Post = pgTable("post", (t) => ({
	content: t.text().notNull(),
	createdAt: t.timestamp().defaultNow().notNull(),
	id: t.uuid().notNull().primaryKey().defaultRandom(),
	title: t.varchar({ length: 256 }).notNull(),
	updatedAt: t
		.timestamp({ mode: "date", withTimezone: true })
		.$onUpdateFn(() => sql`now()`),
}));

export const CreatePostSchema = createInsertSchema(Post, {
	content: z.string().max(256),
	title: z.string().max(256),
}).omit({
	createdAt: true,
	id: true,
	updatedAt: true,
});

export * from "./auth-schema.js";
