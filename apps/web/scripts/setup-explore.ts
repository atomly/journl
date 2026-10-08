import { readFile } from "node:fs/promises";
import { sql } from "@acme/db";
import { db } from "@acme/db/client";

await db.transaction(async (tx) => {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext('journl:explore:schema:v1'))`,
  );
  const rows = await tx.execute<{ count: number }>(
    sql`select count(*)::int as count from information_schema.tables where table_schema = 'public' and table_name in ('explore_cluster', 'explore_cluster_lineage', 'explore_cluster_member', 'explore_cluster_snapshot', 'explore_cluster_source', 'explore_refresh_outbox', 'explore_snapshot', 'explore_state')`,
  );
  if (rows[0]?.count === 8) {
    const constraints = await tx.execute(
      sql`select 1 from pg_constraint where conname = 'explore_state_snapshot_owner_fk' and conrelid = 'public.explore_state'::regclass`,
    );
    if (!constraints.length)
      await tx.execute(
        sql`alter table explore_state add constraint explore_state_snapshot_owner_fk foreign key (user_id, active_snapshot_id) references explore_snapshot (user_id, id)`,
      );
    return;
  }
  if (rows[0]?.count)
    throw new Error(
      "Partial Explore schema exists; inspect before applying migration",
    );
  const migration = await readFile(
    new URL(
      "../../../packages/db/sql/20261008_explore_clusters.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await tx.execute(sql.raw(migration));
});
console.log("Explore schema ready");
process.exit(0);
