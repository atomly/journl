import { and, asc, count, eq, inArray, or, sql } from "@acme/db";
import { BlockSearchText, DocumentReference } from "@acme/db/schema";
import type { ExploreGraph } from "~/references/explore-graph";
import { encodeExploreCursor } from "./cursor";

import {
  exploreContext,
  metadata,
  type Database,
  type ExploreInput,
} from "./query-context";
import { listClusterMembers, listClusterSources } from "./members-service";
export async function getClusterMap(
  database: Database,
  userId: string,
  clusterId: string,
) {
  const context = await exploreContext(
    database,
    userId,
    undefined,
    `map:${clusterId}`,
  );
  const members = await listClusterMembers(
    database,
    userId,
    {
      clusterId,
      limit: 24,
      role: "primary",
    },
    context,
  );
  const sources = await listClusterSources(
    database,
    userId,
    {
      clusterId,
      limit: 6,
    },
    context,
  );
  const graph: ExploreGraph = {
    edges: [],
    nodes: members.items.map((n) => ({
      href: n.href,
      key: `document:${n.id}`,
      kind: n.kind,
      target: { documentId: n.id, kind: "document" },
      title: n.title,
      updatedAt: n.updatedAt,
    })),
  };
  for (const source of sources.items)
    graph.nodes.push({
      href: source.url,
      key: source.key,
      kind: "external",
      target: { kind: "external", url: source.url },
      title: source.title,
    });
  const ids = members.items.map((n) => n.id);
  const keys = sources.items.map((s) => s.key);
  if (ids.length) {
    const targetKey = sql<string>`case when ${DocumentReference.target_document_id} is not null then 'document:' || ${DocumentReference.target_document_id}::text else ${DocumentReference.target_key} end`;
    const rows = await database
      .select({
        blocks: sql<
          string[]
        >`(array_agg(${DocumentReference.source_block_id} order by ${DocumentReference.id}))[1:3]`,
        from: DocumentReference.source_document_id,
        ids: sql<
          string[]
        >`(array_agg(${DocumentReference.id} order by ${DocumentReference.id}))[1:3]`,
        occurrenceCount: count(),
        to: targetKey,
      })
      .from(DocumentReference)
      .where(
        and(
          eq(DocumentReference.user_id, userId),
          inArray(DocumentReference.source_document_id, ids),
          or(
            inArray(DocumentReference.target_document_id, ids),
            keys.length
              ? inArray(DocumentReference.target_key, keys)
              : undefined,
          ),
        ),
      )
      .groupBy(DocumentReference.source_document_id, targetKey)
      .orderBy(asc(DocumentReference.source_document_id), asc(targetKey))
      .limit(121);
    const snippets = rows.length
      ? await database
          .select()
          .from(BlockSearchText)
          .where(
            and(
              eq(BlockSearchText.user_id, userId),
              inArray(
                BlockSearchText.block_id,
                rows.flatMap((r) => r.blocks),
              ),
            ),
          )
      : [];
    const snippetMap = new Map(snippets.map((s) => [s.block_id, s]));
    const noteMap = new Map(members.items.map((n) => [n.id, n]));
    const nodeKeys = new Set(graph.nodes.map((n) => n.key));
    for (const r of rows.slice(0, 120))
      if (nodeKeys.has(r.to))
        graph.edges.push({
          fromKey: `document:${r.from}`,
          occurrenceCount: r.occurrenceCount,
          occurrenceIds: r.ids,
          presentations: [],
          sourceBlocks: r.blocks,
          sources: [...new Set(r.blocks)].flatMap((id) => {
            const snippet = snippetMap.get(id);
            return snippet && snippet.document_id === r.from
              ? [
                  {
                    blockId: id,
                    excerpt: snippet.search_text.slice(0, 240),
                    href: `${noteMap.get(r.from)!.href}#block=${id}`,
                  },
                ]
              : [];
          }),
          toKey: r.to,
        });
    return {
      ...metadata(context),
      graph,
      hasMoreConnections: rows.length > 120,
      omittedNotes: Math.max(0, members.total - members.items.length),
      omittedSources: Math.max(0, sources.total - sources.items.length),
    };
  }
  return {
    graph,
    hasMoreConnections: false,
    omittedNotes: 0,
    omittedSources: sources.total,
    refreshing: members.refreshing,
    restartRequired: members.restartRequired,
    revision: members.revision,
    snapshotId: members.snapshotId,
  };
}

export async function listRelatedThreads(
  database: Database,
  userId: string,
  clusterId: string,
) {
  return (
    await listThreadConnections(database, userId, { clusterId, limit: 24 })
  ).items;
}

/** All authored cross-thread references, paginated independently of the visible map. */
export async function listThreadConnections(
  database: Database,
  userId: string,
  input: ExploreInput & { clusterId: string; snapshotId?: string },
) {
  const scope = `bridges:${input.clusterId}`;
  const context = await exploreContext(
    database,
    userId,
    input.cursor,
    scope,
    input.snapshotId,
  );
  if (!context.snapshotId)
    return {
      ...metadata(context),
      items: [],
      nextCursor: undefined as string | undefined,
      total: 0,
    };
  const bridges = sql`
    with selected as materialized (
      select document_id from explore_cluster_member
      where user_id = ${userId} and snapshot_id = ${context.snapshotId}::uuid
        and cluster_id = ${input.clusterId}::uuid and role = 'primary'
    ), authored as materialized (
      select r.id, r.target_document_id as neighbor
      from selected s join document_reference r on r.source_document_id = s.document_id and r.user_id = ${userId}
      where r.target_document_id is not null
      union all
      select r.id, r.source_document_id as neighbor
      from selected s join document_reference r on r.target_document_id = s.document_id and r.user_id = ${userId}
    ), bridges as materialized (
      select m.cluster_id as other_id, r.id
      from authored r join explore_cluster_member m on m.document_id = r.neighbor
        and m.user_id = ${userId} and m.snapshot_id = ${context.snapshotId}::uuid and m.role = 'primary'
      where m.cluster_id <> ${input.clusterId}::uuid
    ), grouped as (
      select c.id, coalesce(c.manual_name, s.generated_name) as name, count(distinct bridges.id)::int as connections
      from bridges join explore_cluster c on c.id = bridges.other_id and c.user_id = ${userId}
      join explore_cluster_snapshot s on s.cluster_id = c.id and s.user_id = ${userId} and s.snapshot_id = ${context.snapshotId}::uuid
      group by c.id, c.manual_name, s.generated_name
    )`;
  const totals = await database.execute<{ total: number }>(
    sql`${bridges} select count(*)::int as total from grouped`,
  );
  const rows = await database.execute<{
    id: string;
    name: string;
    connections: number;
  }>(sql`${bridges}
    select * from grouped ${context.decoded ? sql`where id > ${context.decoded.after}::uuid` : sql``}
    order by id limit ${input.limit + 1}`);
  const items = [...rows].slice(0, input.limit);
  return {
    ...metadata(context),
    items,
    nextCursor:
      rows.length > input.limit && items.at(-1)
        ? encodeExploreCursor({
            after: items.at(-1)!.id,
            owner: userId,
            scope,
            snapshot: context.snapshotId,
          })
        : undefined,
    total: totals[0]?.total ?? 0,
  };
}
