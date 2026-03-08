import { relations, sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { user } from "../auth/user.schema.ts";
import { TreeNode } from "./tree-node.schema.ts";

export const TreeEdge = pgTable(
  "tree_edge",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    user_id: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    parent_node_id: t.uuid(),
    node_id: t.uuid().notNull(),
    prev_edge_id: t.uuid(),
    next_edge_id: t.uuid(),
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
    foreignKey({
      columns: [t.user_id, t.node_id],
      foreignColumns: [TreeNode.user_id, TreeNode.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.user_id, t.parent_node_id],
      foreignColumns: [TreeNode.user_id, TreeNode.id],
    }).onDelete("cascade"),
    /**
     * We have to write self-references in here, otherwise drizzle runs into TypeScript errors.
     * @see {@link https://github.com/drizzle-team/drizzle-orm/issues/4308 | [BUG]: Self referencing Foreign Key causes any type}
     */
    foreignKey({
      columns: [t.prev_edge_id],
      foreignColumns: [t.id],
    }).onDelete("set null"),
    foreignKey({
      columns: [t.next_edge_id],
      foreignColumns: [t.id],
    }).onDelete("set null"),
    uniqueIndex("tree_edge_user_node_unique_idx").on(t.user_id, t.node_id),
    index("tree_edge_user_parent_idx").on(t.user_id, t.parent_node_id),
    uniqueIndex("tree_edge_user_parent_prev_unique_idx")
      .on(t.user_id, t.parent_node_id, t.prev_edge_id)
      .where(sql`${t.prev_edge_id} is not null`),
    uniqueIndex("tree_edge_user_parent_next_unique_idx")
      .on(t.user_id, t.parent_node_id, t.next_edge_id)
      .where(sql`${t.next_edge_id} is not null`),
    check("tree_edge_not_self_prev", sql`${t.id} <> ${t.prev_edge_id}`),
    check("tree_edge_not_self_next", sql`${t.id} <> ${t.next_edge_id}`),
  ],
);

export const TreeEdgeRelations = relations(TreeEdge, ({ one }) => ({
  node: one(TreeNode, {
    fields: [TreeEdge.node_id],
    references: [TreeNode.id],
  }),
  parent_node: one(TreeNode, {
    fields: [TreeEdge.parent_node_id],
    references: [TreeNode.id],
  }),
  prev_edge: one(TreeEdge, {
    fields: [TreeEdge.prev_edge_id],
    references: [TreeEdge.id],
    relationName: "tree_edge_prev_next",
  }),
  next_edge: one(TreeEdge, {
    fields: [TreeEdge.next_edge_id],
    references: [TreeEdge.id],
    relationName: "tree_edge_prev_next",
  }),
}));

export type TreeEdge = typeof TreeEdge.$inferSelect;

export const zInsertTreeEdge = createInsertSchema(TreeEdge).omit({
  created_at: true,
  id: true,
  updated_at: true,
});

export const zTreeEdge = createSelectSchema(TreeEdge);
