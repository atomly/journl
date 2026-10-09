import { and, asc, count, desc, eq, gt, ilike, lt, or, sql } from "@acme/db";
import {
  Document,
  DocumentReference,
  ExploreCluster,
  ExploreClusterSnapshot,
  JournalEntry,
  Page,
} from "@acme/db/schema";
import { TRPCError } from "@trpc/server";
import { encodeExploreCursor } from "./cursor";

import {
  exploreContext,
  metadata,
  loadNotes,
  type Database,
  type ExploreInput,
} from "./query-context";
export async function listClusters(
  database: Database,
  userId: string,
  input: ExploreInput & { search?: string },
) {
  const search = input.search?.trim() ?? "";
  const scope = `clusters:${search}`;
  const context = await exploreContext(database, userId, input.cursor, scope);
  if (!context.snapshotId)
    return {
      ...metadata(context),
      items: [],
      nextCursor: undefined as string | undefined,
      total: 0,
    };
  const name = sql<string>`coalesce(${ExploreCluster.manual_name}, ${ExploreClusterSnapshot.generated_name})`;
  const condition = and(
    eq(ExploreClusterSnapshot.user_id, userId),
    eq(ExploreClusterSnapshot.snapshot_id, context.snapshotId),
    search ? ilike(name, `%${search.replace(/[\\%_]/g, "\\$&")}%`) : undefined,
  );
  const [total] = await database
    .select({ count: count() })
    .from(ExploreClusterSnapshot)
    .innerJoin(
      ExploreCluster,
      eq(ExploreCluster.id, ExploreClusterSnapshot.cluster_id),
    )
    .where(condition);
  const rows = await database
    .select({
      id: ExploreClusterSnapshot.cluster_id,
      lastActivity: ExploreClusterSnapshot.last_activity,
      name,
      primaryCount: ExploreClusterSnapshot.primary_count,
      relatedCount: ExploreClusterSnapshot.related_count,
      representatives: ExploreClusterSnapshot.representatives,
      sourceCount: ExploreClusterSnapshot.source_count,
    })
    .from(ExploreClusterSnapshot)
    .innerJoin(
      ExploreCluster,
      and(
        eq(ExploreCluster.id, ExploreClusterSnapshot.cluster_id),
        eq(ExploreCluster.user_id, userId),
      ),
    )
    .where(
      and(
        condition,
        context.decoded
          ? or(
              lt(ExploreClusterSnapshot.last_activity, context.decoded.date!),
              and(
                eq(ExploreClusterSnapshot.last_activity, context.decoded.date!),
                gt(ExploreClusterSnapshot.cluster_id, context.decoded.after),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(
      desc(ExploreClusterSnapshot.last_activity),
      asc(ExploreClusterSnapshot.cluster_id),
    )
    .limit(input.limit + 1);
  const visible = rows.slice(0, input.limit);
  const notes = await loadNotes(
    database,
    userId,
    visible.flatMap((r) => r.representatives),
  );
  const byId = new Map(notes.map((n) => [n.id, n]));
  const last = visible.at(-1);
  return {
    ...metadata(context),
    items: visible.map((r) => ({
      ...r,
      representatives: r.representatives.flatMap((id) =>
        byId.has(id) ? [byId.get(id)!] : [],
      ),
    })),
    nextCursor:
      rows.length > input.limit && last
        ? encodeExploreCursor({
            after: last.id,
            date: last.lastActivity,
            owner: userId,
            scope,
            snapshot: context.snapshotId,
          })
        : undefined,
    total: total!.count,
  };
}

export async function getCluster(
  database: Database,
  userId: string,
  clusterId: string,
  successorCursor?: string,
) {
  const context = await exploreContext(
    database,
    userId,
    successorCursor,
    `cluster:${clusterId}`,
  );
  const [identity] = await database
    .select()
    .from(ExploreCluster)
    .where(
      and(eq(ExploreCluster.user_id, userId), eq(ExploreCluster.id, clusterId)),
    )
    .limit(1);
  if (!identity)
    throw new TRPCError({ code: "NOT_FOUND", message: "Thread not found" });
  const [summary] = context.snapshotId
    ? await database
        .select()
        .from(ExploreClusterSnapshot)
        .where(
          and(
            eq(ExploreClusterSnapshot.user_id, userId),
            eq(ExploreClusterSnapshot.snapshot_id, context.snapshotId),
            eq(ExploreClusterSnapshot.cluster_id, clusterId),
          ),
        )
        .limit(1)
    : [];
  // Follow retired identities through successive splits/merges, not only one generation.
  // UNION deduplicates identities, so even malformed cyclic lineage terminates.
  const descendants = sql`
    with recursive descendants(id) as (
      select to_id from explore_cluster_lineage
      where user_id = ${userId} and from_id = ${clusterId}::uuid
        and source_revision <= ${context.revision}
      union
      select l.to_id from explore_cluster_lineage l
      join descendants d on l.from_id = d.id where l.user_id = ${userId}
        and l.source_revision <= ${context.revision}
    ), active as (
      select c.id, coalesce(c.manual_name, s.generated_name) as name
      from descendants d join explore_cluster c on c.id = d.id and c.user_id = ${userId}
      join explore_cluster_snapshot s on s.cluster_id = c.id
        and s.user_id = ${userId} and s.snapshot_id = ${context.snapshotId}::uuid
    )`;
  const successorRows =
    !summary && context.snapshotId
      ? [
          ...(await database.execute<{
            id: string;
            name: string;
          }>(sql`${descendants}
      select * from active ${context.decoded ? sql`where id > ${context.decoded.after}::uuid` : sql``}
      order by id limit 25`)),
        ]
      : [];
  const successorCounts =
    !summary && context.snapshotId
      ? await database.execute<{ total: number }>(
          sql`${descendants} select count(*)::int as total from active`,
        )
      : [];
  const successors = successorRows.slice(0, 24);
  return {
    ...metadata(context),
    nextSuccessorCursor:
      successorRows.length > 24 && successors.at(-1) && context.snapshotId
        ? encodeExploreCursor({
            after: successors.at(-1)!.id,
            owner: userId,
            scope: `cluster:${clusterId}`,
            snapshot: context.snapshotId,
          })
        : undefined,
    successors,
    successorTotal: successorCounts[0]?.total ?? 0,
    summary: summary
      ? {
          id: clusterId,
          lastActivity: summary.last_activity,
          name: identity.manual_name ?? summary.generated_name,
          primaryCount: summary.primary_count,
          relatedCount: summary.related_count,
          representatives: await loadNotes(
            database,
            userId,
            summary.representatives,
          ),
          sourceCount: summary.source_count,
        }
      : null,
  };
}

export async function listRecentNotes(
  database: Database,
  userId: string,
  input: ExploreInput & { sort: "latest" | "oldest"; unlinkedOnly: boolean },
) {
  const scope = `recent:${input.sort}:${input.unlinkedOnly}`;
  const context = await exploreContext(database, userId, input.cursor, scope);
  const latest = input.sort === "latest";
  const updated = sql<string>`greatest(${Document.updated_at}, ${Page.updated_at})`;
  const condition = and(
    eq(Document.user_id, userId),
    or(sql`${Page.id} is not null`, sql`${JournalEntry.id} is not null`),
    input.unlinkedOnly
      ? sql`not exists (select 1 from ${DocumentReference} r where r.user_id = ${userId} and (r.source_document_id = ${Document.id} or r.target_document_id = ${Document.id}))`
      : undefined,
  );
  const [total] = await database
    .select({ count: count() })
    .from(Document)
    .leftJoin(Page, eq(Page.document_id, Document.id))
    .leftJoin(JournalEntry, eq(JournalEntry.document_id, Document.id))
    .where(condition);
  const rows = await database
    .select({ id: Document.id, updated })
    .from(Document)
    .leftJoin(
      Page,
      and(eq(Page.document_id, Document.id), eq(Page.user_id, userId)),
    )
    .leftJoin(
      JournalEntry,
      and(
        eq(JournalEntry.document_id, Document.id),
        eq(JournalEntry.user_id, userId),
      ),
    )
    .where(
      and(
        condition,
        context.decoded
          ? or(
              latest
                ? lt(updated, context.decoded.date!)
                : gt(updated, context.decoded.date!),
              and(
                eq(updated, context.decoded.date!),
                gt(Document.id, context.decoded.after),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(latest ? desc(updated) : asc(updated), asc(Document.id))
    .limit(input.limit + 1);
  const visible = rows.slice(0, input.limit);
  const notes = await loadNotes(
    database,
    userId,
    visible.map((r) => r.id),
  );
  const byId = new Map(notes.map((n) => [n.id, n]));
  const last = visible.at(-1);
  return {
    ...metadata(context),
    items: visible.flatMap((r) =>
      byId.has(r.id) ? [{ ...byId.get(r.id)!, updatedAt: r.updated }] : [],
    ),
    nextCursor:
      rows.length > input.limit && last
        ? encodeExploreCursor({
            after: last.id,
            date: last.updated,
            owner: userId,
            scope,
            snapshot: null,
          })
        : undefined,
    total: total!.count,
  };
}
