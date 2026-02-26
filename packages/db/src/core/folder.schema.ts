import { relations, sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgTable,
  text,
  varchar,
} from "drizzle-orm/pg-core";
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
    parent_folder_id: t.uuid(),
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
    /**
     * We have to write self-references in here, otherwise drizzle runs into TypeScript errors.
     * @see {@link https://github.com/drizzle-team/drizzle-orm/issues/4308 | [BUG]: Self referencing Foreign Key causes any type}
     */
    foreignKey({
      columns: [t.parent_folder_id],
      foreignColumns: [t.id],
    }).onDelete("cascade"),
    check("folder_no_self_parent", sql`${t.id} <> ${t.parent_folder_id}`),
    index("folder_user_id_parent_folder_id_updated_at_desc_id_desc_index").on(
      t.user_id,
      t.parent_folder_id,
      t.updated_at.desc(),
      t.id.desc(),
    ),
    index("folder_user_id_updated_at_desc_id_desc_index").on(
      t.user_id,
      t.updated_at.desc(),
      t.id.desc(),
    ),
  ],
);

export const FolderRelations = relations(Folder, ({ one, many }) => ({
  children: many(Folder, {
    relationName: "folder_parent_child_relation",
  }),
  parent: one(Folder, {
    fields: [Folder.parent_folder_id],
    references: [Folder.id],
    relationName: "folder_parent_child_relation",
  }),
}));

export type Folder = typeof Folder.$inferSelect;

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
