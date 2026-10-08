import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "../auth/user.schema.ts";
import { Document } from "./document.schema.ts";

const owner = () =>
  text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });
const time = () =>
  timestamp({ mode: "string", withTimezone: true }).notNull().defaultNow();

export const ExploreState = pgTable(
  "explore_state",
  {
    user_id: owner().primaryKey(),
    source_revision: integer().notNull().default(0),
    published_revision: integer().notNull().default(-1),
    active_snapshot_id: uuid(),
    dirty_at: time(),
    lease_token: uuid(),
    lease_until: timestamp({ mode: "string", withTimezone: true }),
  },
  (t) => [
    foreignKey({
      name: "explore_state_snapshot_owner_fk",
      columns: [t.user_id, t.active_snapshot_id],
      foreignColumns: [ExploreSnapshot.user_id, ExploreSnapshot.id],
    }),
  ],
);

export const ExploreSnapshot = pgTable(
  "explore_snapshot",
  {
    id: uuid().notNull().primaryKey().defaultRandom(),
    user_id: owner(),
    source_revision: integer().notNull(),
    algorithm_version: text().notNull(),
    created_at: time(),
  },
  (t) => [
    uniqueIndex("explore_snapshot_owner_id").on(t.user_id, t.id),
    uniqueIndex("explore_snapshot_revision").on(
      t.user_id,
      t.source_revision,
      t.algorithm_version,
    ),
  ],
);

export const ExploreCluster = pgTable(
  "explore_cluster",
  {
    id: uuid().notNull().primaryKey().defaultRandom(),
    user_id: owner(),
    manual_name: text(),
    retired_at: timestamp({ mode: "string", withTimezone: true }),
  },
  (t) => [uniqueIndex("explore_cluster_owner_id").on(t.user_id, t.id)],
);

export const ExploreClusterSnapshot = pgTable(
  "explore_cluster_snapshot",
  {
    user_id: owner(),
    snapshot_id: uuid().notNull(),
    cluster_id: uuid().notNull(),
    generated_name: text().notNull(),
    representatives: jsonb().$type<string[]>().notNull(),
    primary_count: integer().notNull(),
    related_count: integer().notNull(),
    source_count: integer().notNull(),
    last_activity: time(),
  },
  (t) => [
    primaryKey({ columns: [t.snapshot_id, t.cluster_id] }),
    uniqueIndex("explore_summary_owner_key").on(
      t.user_id,
      t.snapshot_id,
      t.cluster_id,
    ),
    foreignKey({
      columns: [t.user_id, t.snapshot_id],
      foreignColumns: [ExploreSnapshot.user_id, ExploreSnapshot.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.user_id, t.cluster_id],
      foreignColumns: [ExploreCluster.user_id, ExploreCluster.id],
    }).onDelete("cascade"),
    index("explore_summary_activity").on(
      t.user_id,
      t.snapshot_id,
      t.last_activity.desc(),
      t.cluster_id,
    ),
  ],
);

export const ExploreClusterMember = pgTable(
  "explore_cluster_member",
  {
    user_id: owner(),
    snapshot_id: uuid().notNull(),
    cluster_id: uuid().notNull(),
    document_id: uuid()
      .notNull()
      .references(() => Document.id, { onDelete: "cascade" }),
    role: text().notNull(),
    evidence_ids: jsonb().$type<string[]>().notNull().default([]),
  },
  (t) => [
    primaryKey({ columns: [t.snapshot_id, t.cluster_id, t.document_id] }),
    foreignKey({
      columns: [t.user_id, t.document_id],
      foreignColumns: [Document.user_id, Document.id],
    }).onDelete("cascade"),
    check("explore_member_role", sql`${t.role} in ('primary', 'related')`),
    foreignKey({
      columns: [t.user_id, t.snapshot_id, t.cluster_id],
      foreignColumns: [
        ExploreClusterSnapshot.user_id,
        ExploreClusterSnapshot.snapshot_id,
        ExploreClusterSnapshot.cluster_id,
      ],
    }).onDelete("cascade"),
    uniqueIndex("explore_primary_membership")
      .on(t.snapshot_id, t.document_id)
      .where(sql`${t.role} = 'primary'`),
    index("explore_member_document").on(
      t.user_id,
      t.snapshot_id,
      t.document_id,
    ),
    index("explore_member_cluster").on(
      t.user_id,
      t.snapshot_id,
      t.cluster_id,
      t.role,
      t.document_id,
    ),
  ],
);

export const ExploreClusterSource = pgTable(
  "explore_cluster_source",
  {
    user_id: owner(),
    snapshot_id: uuid().notNull(),
    cluster_id: uuid().notNull(),
    target_key: text().notNull(),
    url: text().notNull(),
    document_count: integer().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.snapshot_id, t.cluster_id, t.target_key] }),
    foreignKey({
      columns: [t.user_id, t.snapshot_id, t.cluster_id],
      foreignColumns: [
        ExploreClusterSnapshot.user_id,
        ExploreClusterSnapshot.snapshot_id,
        ExploreClusterSnapshot.cluster_id,
      ],
    }).onDelete("cascade"),
  ],
);

export const ExploreClusterLineage = pgTable(
  "explore_cluster_lineage",
  {
    user_id: owner(),
    from_id: uuid().notNull(),
    to_id: uuid().notNull(),
    created_at: time(),
  },
  (t) => [
    primaryKey({ columns: [t.from_id, t.to_id] }),
    foreignKey({
      columns: [t.user_id, t.from_id],
      foreignColumns: [ExploreCluster.user_id, ExploreCluster.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.user_id, t.to_id],
      foreignColumns: [ExploreCluster.user_id, ExploreCluster.id],
    }).onDelete("cascade"),
  ],
);

export const ExploreRefreshOutbox = pgTable("explore_refresh_outbox", {
  user_id: owner().primaryKey(),
  revision: integer().notNull(),
  requested_at: time(),
  dispatched_at: timestamp({ mode: "string", withTimezone: true }),
});
