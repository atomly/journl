import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { user } from "../auth/user.schema.ts";
import { Folder } from "./folder.schema.ts";
import { Page } from "./page.schema.ts";

export const TreeNodeType = pgEnum("tree_node_type", ["folder", "page"]);

export const TreeNode = pgTable(
  "tree_node",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    user_id: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    node_type: TreeNodeType().notNull(),
    folder_id: t.uuid().references(() => Folder.id, { onDelete: "cascade" }),
    page_id: t.uuid().references(() => Page.id, { onDelete: "cascade" }),
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
    index("tree_node_user_id_id_idx").on(t.user_id, t.id),
    uniqueIndex("tree_node_user_folder_unique_idx")
      .on(t.user_id, t.folder_id)
      .where(sql`${t.folder_id} is not null`),
    uniqueIndex("tree_node_user_page_unique_idx")
      .on(t.user_id, t.page_id)
      .where(sql`${t.page_id} is not null`),
    check(
      "tree_node_exactly_one_type_target",
      sql`(case when ${t.folder_id} is null then 0 else 1 end) + (case when ${t.page_id} is null then 0 else 1 end) = 1`,
    ),
    check(
      "tree_node_folder_target_matches_type",
      sql`(${t.node_type} != 'folder') or (${t.folder_id} is not null and ${t.page_id} is null)`,
    ),
    check(
      "tree_node_page_target_matches_type",
      sql`(${t.node_type} != 'page') or (${t.page_id} is not null and ${t.folder_id} is null)`,
    ),
    index("tree_node_user_node_type_idx").on(t.user_id, t.node_type),
  ],
);

export const TreeNodeRelations = relations(TreeNode, ({ one }) => ({
  folder: one(Folder, {
    fields: [TreeNode.folder_id],
    references: [Folder.id],
  }),
  page: one(Page, {
    fields: [TreeNode.page_id],
    references: [Page.id],
  }),
}));

export type TreeNode = typeof TreeNode.$inferSelect;

export const zInsertTreeNode = createInsertSchema(TreeNode, {
  node_type: z.enum(["folder", "page"]),
}).omit({
  created_at: true,
  id: true,
  updated_at: true,
});

export const zTreeNode = createSelectSchema(TreeNode);
