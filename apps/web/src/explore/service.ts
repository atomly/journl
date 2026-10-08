import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  lt,
  or,
  sql,
} from "@acme/db";
import {
  BlockSearchText,
  Document,
  DocumentReference,
  ExploreCluster,
  ExploreClusterMember,
  ExploreClusterSnapshot,
  ExploreClusterSource,
  ExploreRefreshOutbox,
  ExploreSnapshot,
  JournalEntry,
  Page,
} from "@acme/db/schema";
import { TRPCError } from "@trpc/server";
import { dispatchExploreRefresh } from "~/explore/dispatch";
import type { ExploreGraph } from "~/references/explore-graph";
import { getExternalGraphTitle } from "~/references/graph-utils";
import type { TRPCContext } from "~/trpc/trpc";
import { decodeExploreCursor, encodeExploreCursor } from "./cursor";
import { ensureExploreState } from "./refresh";

type Database = TRPCContext["db"];
export type ExploreInput = { cursor?: string; limit: number };

export async function exploreContext(
  database: Database,
  userId: string,
  cursor: string | undefined,
  scope: string,
) {
  const state = await ensureExploreState(database, userId);
  if (state.published_revision < state.source_revision) {
    await database
      .insert(ExploreRefreshOutbox)
      .values({ revision: state.source_revision, user_id: userId })
      .onConflictDoNothing();
    await dispatchExploreRefresh(userId);
  }
  let decoded: ReturnType<typeof decodeExploreCursor>;
  try {
    decoded = decodeExploreCursor(cursor, userId, scope);
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid exploration cursor",
    });
  }
  const snapshotId = decoded ? decoded.snapshot : state.active_snapshot_id;
  if (snapshotId) {
    const [snapshot] = await database
      .select()
      .from(ExploreSnapshot)
      .where(
        and(
          eq(ExploreSnapshot.id, snapshotId),
          eq(ExploreSnapshot.user_id, userId),
        ),
      )
      .limit(1);
    if (!snapshot)
      return {
        decoded,
        restartRequired: true,
        revision: state.published_revision,
        snapshotId: null,
        state,
      };
    return {
      decoded,
      restartRequired: false,
      revision: snapshot.source_revision,
      snapshotId,
      state,
    };
  }
  return {
    decoded,
    restartRequired: false,
    revision: state.published_revision,
    snapshotId,
    state,
  };
}
function metadata(context: Awaited<ReturnType<typeof exploreContext>>) {
  return {
    refreshing:
      context.state.source_revision > context.state.published_revision,
    restartRequired: context.restartRequired,
    revision: context.revision,
    snapshotId: context.snapshotId,
  };
}

export async function loadNotes(
  database: Database,
  userId: string,
  ids: string[],
) {
  if (!ids.length) return [];
  const rows = await database
    .select({
      date: JournalEntry.date,
      id: Document.id,
      pageId: Page.id,
      pageTitle: Page.title,
      updatedAt: Document.updated_at,
    })
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
    .where(and(eq(Document.user_id, userId), inArray(Document.id, ids)));
  return rows
    .filter((r) => r.pageId || r.date)
    .map((r) => ({
      href: r.pageId ? `/pages/${r.pageId}` : `/journal/${r.date}`,
      id: r.id,
      kind: r.pageId ? ("page" as const) : ("journal" as const),
      title: r.pageTitle ?? r.date!,
      updatedAt: r.updatedAt,
    }));
}

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
) {
  const context = await exploreContext(
    database,
    userId,
    undefined,
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
  const successors =
    !summary && context.snapshotId
      ? [
          ...(await database.execute<{ id: string; name: string }>(sql`
        with recursive descendants(id) as (
          select to_id from explore_cluster_lineage
          where user_id = ${userId} and from_id = ${clusterId}::uuid
          union
          select l.to_id from explore_cluster_lineage l
          join descendants d on l.from_id = d.id
          where l.user_id = ${userId}
        )
        select c.id, coalesce(c.manual_name, s.generated_name) as name
        from descendants d
        join explore_cluster c on c.id = d.id and c.user_id = ${userId}
        join explore_cluster_snapshot s on s.cluster_id = c.id
          and s.user_id = ${userId} and s.snapshot_id = ${context.snapshotId}::uuid
        order by c.id limit 24
      `)),
        ]
      : [];
  return {
    ...metadata(context),
    successors,
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

export async function listClusterMembers(
  database: Database,
  userId: string,
  input: ExploreInput & { clusterId: string; role: "primary" | "related" },
  fixedContext?: Awaited<ReturnType<typeof exploreContext>>,
) {
  const scope = `members:${input.clusterId}:${input.role}`;
  const context =
    fixedContext ??
    (await exploreContext(database, userId, input.cursor, scope));
  if (!context.snapshotId)
    return {
      ...metadata(context),
      items: [],
      nextCursor: undefined as string | undefined,
      total: 0,
    };
  const condition = and(
    eq(ExploreClusterMember.user_id, userId),
    eq(ExploreClusterMember.snapshot_id, context.snapshotId),
    eq(ExploreClusterMember.cluster_id, input.clusterId),
    eq(ExploreClusterMember.role, input.role),
  );
  const [total] = await database
    .select({ count: count() })
    .from(ExploreClusterMember)
    .where(condition);
  const rows = await database
    .select()
    .from(ExploreClusterMember)
    .where(
      and(
        condition,
        context.decoded
          ? gt(ExploreClusterMember.document_id, context.decoded.after)
          : undefined,
      ),
    )
    .orderBy(asc(ExploreClusterMember.document_id))
    .limit(input.limit + 1);
  const visible = rows.slice(0, input.limit);
  const notes = await loadNotes(
    database,
    userId,
    visible.map((m) => m.document_id),
  );
  const byId = new Map(notes.map((n) => [n.id, n]));
  const evidenceIds = [
    ...new Set(visible.flatMap((member) => member.evidence_ids.slice(0, 3))),
  ];
  const evidence = evidenceIds.length
    ? await database
        .select({
          blockId: DocumentReference.source_block_id,
          date: JournalEntry.date,
          excerpt: BlockSearchText.search_text,
          id: DocumentReference.id,
          kind: DocumentReference.target_kind,
          pageId: Page.id,
        })
        .from(DocumentReference)
        .innerJoin(
          BlockSearchText,
          and(
            eq(BlockSearchText.user_id, userId),
            eq(BlockSearchText.block_id, DocumentReference.source_block_id),
            eq(
              BlockSearchText.document_id,
              DocumentReference.source_document_id,
            ),
          ),
        )
        .leftJoin(
          Page,
          and(
            eq(Page.user_id, userId),
            eq(Page.document_id, DocumentReference.source_document_id),
          ),
        )
        .leftJoin(
          JournalEntry,
          and(
            eq(JournalEntry.user_id, userId),
            eq(JournalEntry.document_id, DocumentReference.source_document_id),
          ),
        )
        .where(
          and(
            eq(DocumentReference.user_id, userId),
            inArray(DocumentReference.id, evidenceIds),
          ),
        )
    : [];
  const byEvidence = new Map(
    evidence.map((r) => [
      r.id,
      {
        excerpt: r.excerpt.slice(0, 240),
        href: r.pageId
          ? `/pages/${r.pageId}#block=${r.blockId}`
          : `/journal/${r.date}#block=${r.blockId}`,
        id: r.id,
        kind: r.kind,
      },
    ]),
  );
  const last = visible.at(-1);
  return {
    ...metadata(context),
    items: visible.flatMap((m) =>
      byId.has(m.document_id)
        ? [
            {
              ...byId.get(m.document_id)!,
              evidence: m.evidence_ids
                .slice(0, 3)
                .flatMap((id) =>
                  byEvidence.has(id) ? [byEvidence.get(id)!] : [],
                ),
              evidenceIds: m.evidence_ids
                .filter((id) => byEvidence.has(id))
                .slice(0, 3),
              role: input.role,
            },
          ]
        : [],
    ),
    nextCursor:
      rows.length > input.limit && last
        ? encodeExploreCursor({
            after: last.document_id,
            owner: userId,
            scope,
            snapshot: context.snapshotId,
          })
        : undefined,
    total: total!.count,
  };
}

export async function listClusterSources(
  database: Database,
  userId: string,
  input: ExploreInput & { clusterId: string },
  fixedContext?: Awaited<ReturnType<typeof exploreContext>>,
) {
  const scope = `sources:${input.clusterId}`;
  const context =
    fixedContext ??
    (await exploreContext(database, userId, input.cursor, scope));
  if (!context.snapshotId)
    return {
      ...metadata(context),
      items: [],
      nextCursor: undefined as string | undefined,
      total: 0,
    };
  const condition = and(
    eq(ExploreClusterSource.user_id, userId),
    eq(ExploreClusterSource.snapshot_id, context.snapshotId),
    eq(ExploreClusterSource.cluster_id, input.clusterId),
  );
  const [total] = await database
    .select({ count: count() })
    .from(ExploreClusterSource)
    .where(condition);
  const rows = await database
    .select()
    .from(ExploreClusterSource)
    .where(
      and(
        condition,
        context.decoded
          ? gt(ExploreClusterSource.target_key, context.decoded.after)
          : undefined,
      ),
    )
    .orderBy(asc(ExploreClusterSource.target_key))
    .limit(input.limit + 1);
  const visible = rows.slice(0, input.limit);
  const last = visible.at(-1);
  return {
    ...metadata(context),
    items: visible.map((s) => ({
      documentCount: s.document_count,
      key: s.target_key,
      title: getExternalGraphTitle(s.url),
      url: s.url,
    })),
    nextCursor:
      rows.length > input.limit && last
        ? encodeExploreCursor({
            after: last.target_key,
            owner: userId,
            scope,
            snapshot: context.snapshotId,
          })
        : undefined,
    total: total!.count,
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

export async function listSourceContexts(
  database: Database,
  userId: string,
  input: ExploreInput & { clusterId: string; key: string },
) {
  const scope = `source-context:${input.clusterId}:${input.key}`;
  const context = await exploreContext(database, userId, input.cursor, scope);
  if (!context.snapshotId)
    return {
      ...metadata(context),
      items: [],
      nextCursor: undefined as string | undefined,
    };
  const rows = await database
    .selectDistinctOn([DocumentReference.source_block_id], {
      blockId: DocumentReference.source_block_id,
      documentId: DocumentReference.source_document_id,
      excerpt: BlockSearchText.search_text,
    })
    .from(DocumentReference)
    .innerJoin(
      ExploreClusterMember,
      and(
        eq(ExploreClusterMember.user_id, userId),
        eq(ExploreClusterMember.snapshot_id, context.snapshotId),
        eq(ExploreClusterMember.cluster_id, input.clusterId),
        eq(
          ExploreClusterMember.document_id,
          DocumentReference.source_document_id,
        ),
      ),
    )
    .innerJoin(
      BlockSearchText,
      and(
        eq(BlockSearchText.user_id, userId),
        eq(BlockSearchText.block_id, DocumentReference.source_block_id),
        eq(BlockSearchText.document_id, DocumentReference.source_document_id),
      ),
    )
    .where(
      and(
        eq(DocumentReference.user_id, userId),
        eq(DocumentReference.target_key, input.key),
        context.decoded
          ? gt(DocumentReference.source_block_id, context.decoded.after)
          : undefined,
      ),
    )
    .orderBy(asc(DocumentReference.source_block_id))
    .limit(input.limit + 1);
  const visible = rows.slice(0, input.limit);
  const notes = await loadNotes(
    database,
    userId,
    visible.map((r) => r.documentId),
  );
  const byId = new Map(notes.map((n) => [n.id, n]));
  const last = visible.at(-1);
  return {
    ...metadata(context),
    items: visible.flatMap((r) => {
      const n = byId.get(r.documentId);
      return n
        ? [
            {
              blockId: r.blockId,
              excerpt: r.excerpt.slice(0, 600),
              href: `${n.href}#block=${r.blockId}`,
              note: n,
            },
          ]
        : [];
    }),
    nextCursor:
      rows.length > input.limit && last
        ? encodeExploreCursor({
            after: last.blockId,
            owner: userId,
            scope,
            snapshot: context.snapshotId,
          })
        : undefined,
  };
}

export async function listRelatedThreads(
  database: Database,
  userId: string,
  clusterId: string,
) {
  const context = await exploreContext(
    database,
    userId,
    undefined,
    `bridges:${clusterId}`,
  );
  if (!context.snapshotId) return [];
  const rows = await database.execute<{
    id: string;
    name: string;
    connections: number;
  }>(sql`
    with bridges as (
      select case when a.cluster_id = ${clusterId}::uuid then b.cluster_id else a.cluster_id end as other_id, r.id
      from document_reference r
      join explore_cluster_member a on a.document_id = r.source_document_id and a.user_id = ${userId} and a.snapshot_id = ${context.snapshotId}::uuid and a.role = 'primary'
      join explore_cluster_member b on b.document_id = r.target_document_id and b.user_id = ${userId} and b.snapshot_id = ${context.snapshotId}::uuid and b.role = 'primary'
      where r.user_id = ${userId} and a.cluster_id <> b.cluster_id and (a.cluster_id = ${clusterId}::uuid or b.cluster_id = ${clusterId}::uuid)
    )
    select c.id, coalesce(c.manual_name, s.generated_name) as name, count(distinct bridges.id)::int as connections
    from bridges join explore_cluster c on c.id = bridges.other_id and c.user_id = ${userId}
    join explore_cluster_snapshot s on s.cluster_id = c.id and s.user_id = ${userId} and s.snapshot_id = ${context.snapshotId}::uuid
    group by c.id, c.manual_name, s.generated_name order by connections desc, c.id limit 24
  `);
  return [...rows];
}
