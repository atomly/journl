import { relations, sql } from "drizzle-orm";
import { index, pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { user } from "../auth/user.schema.ts";
import { TEXT_LIMITS } from "../constants/resource-limits.ts";

export const Folder = pgTable(
  "folder",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    user_id: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: TEXT_LIMITS.PAGE_TITLE }).notNull(),
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
  (t) => [
    index("folder_user_id_updated_at_desc_id_desc_index").on(
      t.user_id,
      t.updated_at.desc(),
      t.id.desc(),
    ),
  ],
);

export const FolderRelations = relations(Folder, () => ({}));

type FolderRow = typeof Folder.$inferSelect;
export type Folder = FolderRow & {
  edge_id?: string | null;
  node_id?: string | null;
  parent_node_id?: string | null;
};

export const zInsertFolder = createInsertSchema(Folder, {
  name: z.string().max(TEXT_LIMITS.PAGE_TITLE),
}).omit({
  created_at: true,
  id: true,
  updated_at: true,
  user_id: true,
});

export const zUpdateFolder = createInsertSchema(Folder, {
  name: z.string().min(1).max(TEXT_LIMITS.PAGE_TITLE),
})
  .pick({
    name: true,
  })
  .strict();

export const zFolder = createSelectSchema(Folder);
