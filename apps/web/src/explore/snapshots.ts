import { randomUUID } from "node:crypto";
import { and, eq, inArray, lt, lte, or, sql } from "@acme/db";
import { db } from "@acme/db/client";
import {
  Document,
  DocumentReference,
  ExploreCluster,
  ExploreClusterLineage,
  ExploreClusterMember,
  ExploreClusterSnapshot,
  ExploreClusterSource,
  ExploreRefreshOutbox,
  ExploreSnapshot,
  ExploreState,
  JournalEntry,
  Page,
} from "@acme/db/schema";
import {
  ALGORITHM_VERSION,
  buildClusters,
  type ClusterNote,
  clusterLineage,
  matchClusterIdentities,
} from "./clustering";

export async function refreshExploreSnapshot(userId: string) {
  const token = randomUUID();
  const [lease] = await db
    .update(ExploreState)
    .set({
      lease_token: token,
      lease_until: sql`now() + interval '10 minutes'`,
    })
    .where(
      and(
        eq(ExploreState.user_id, userId),
        or(
          sql`${ExploreState.lease_until} is null`,
          lt(ExploreState.lease_until, sql`now()`),
        ),
      ),
    )
    .returning();
  if (!lease) return "busy" as const;
  try {
    const input = await db.transaction(
      async (tx) => {
        const [state] = await tx
          .select()
          .from(ExploreState)
          .where(eq(ExploreState.user_id, userId));
        if (state!.published_revision >= state!.source_revision) {
          // A read can recreate a request after publication removed it. Consume
          // satisfied requests without removing a later edit's revision.
          await tx
            .delete(ExploreRefreshOutbox)
            .where(
              and(
                eq(ExploreRefreshOutbox.user_id, userId),
                lte(ExploreRefreshOutbox.revision, state!.published_revision),
              ),
            );
          return null;
        }
        const rows = await tx
          .select({
            date: JournalEntry.date,
            id: Document.id,
            pageId: Page.id,
            pageTitle: Page.title,
            pageUpdatedAt: Page.updated_at,
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
          .where(eq(Document.user_id, userId));
        const notes: ClusterNote[] = rows
          .filter((r) => r.pageId || r.date)
          .map((r) => ({
            href: r.pageId ? `/pages/${r.pageId}` : `/journal/${r.date}`,
            id: r.id,
            kind: r.pageId ? "page" : "journal",
            title: r.pageTitle ?? r.date!,
            updatedAt:
              r.pageUpdatedAt && r.pageUpdatedAt > r.updatedAt
                ? r.pageUpdatedAt
                : r.updatedAt,
          }));
        const references = await tx
          .select({
            id: DocumentReference.id,
            source: DocumentReference.source_document_id,
            sourceKey: DocumentReference.target_key,
            target: DocumentReference.target_document_id,
            url: DocumentReference.target_url,
          })
          .from(DocumentReference)
          .where(eq(DocumentReference.user_id, userId));
        const summaries = state!.active_snapshot_id
          ? await tx
              .select()
              .from(ExploreClusterSnapshot)
              .where(
                and(
                  eq(ExploreClusterSnapshot.user_id, userId),
                  eq(
                    ExploreClusterSnapshot.snapshot_id,
                    state!.active_snapshot_id,
                  ),
                ),
              )
          : [];
        const members = state!.active_snapshot_id
          ? await tx
              .select()
              .from(ExploreClusterMember)
              .where(
                and(
                  eq(ExploreClusterMember.user_id, userId),
                  eq(
                    ExploreClusterMember.snapshot_id,
                    state!.active_snapshot_id,
                  ),
                  eq(ExploreClusterMember.role, "primary"),
                ),
              )
          : [];
        const byCluster = new Map<string, string[]>();
        for (const member of members) {
          const list = byCluster.get(member.cluster_id) ?? [];
          list.push(member.document_id);
          byCluster.set(member.cluster_id, list);
        }
        return {
          notes,
          previous: summaries.map((c) => ({
            id: c.cluster_id,
            members: byCluster.get(c.cluster_id) ?? [],
            name: c.generated_name,
          })),
          references,
          revision: state!.source_revision,
        };
      },
      { isolationLevel: "repeatable read" },
    );
    if (!input) return "current" as const;
    const candidates = buildClusters(input.notes, input.references);
    const { assigned, overlaps } = matchClusterIdentities(
      candidates,
      input.previous,
    );
    const ids = candidates.map((_, i) => assigned.get(i)?.id ?? randomUUID());
    const snapshotId = randomUUID();
    const result = await db.transaction(async (tx) => {
      const [state] = await tx
        .select()
        .from(ExploreState)
        .where(eq(ExploreState.user_id, userId))
        .for("update");
      // Fencing token prevents an expired worker from publishing over its successor.
      if (
        state!.lease_token !== token ||
        state!.published_revision >= input.revision
      )
        return "superseded" as const;
      if (state!.source_revision !== input.revision) return "dirty" as const;
      await tx.insert(ExploreSnapshot).values({
        algorithm_version: ALGORITHM_VERSION,
        id: snapshotId,
        source_revision: input.revision,
        user_id: userId,
      });
      const summaryRows: (typeof ExploreClusterSnapshot.$inferInsert)[] = [];
      const memberRows: (typeof ExploreClusterMember.$inferInsert)[] = [];
      const sourceRows: (typeof ExploreClusterSource.$inferInsert)[] = [];
      const noteById = new Map(input.notes.map((n) => [n.id, n]));
      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i]!;
        const clusterId = ids[i]!;
        const oldName = assigned.get(i)?.name;
        const name =
          oldName &&
          c.primaryDocumentIds.some((id) => {
            const n = noteById.get(id);
            return n?.kind === "page" && n.title.trim() === oldName;
          })
            ? oldName
            : c.generatedName;
        const shared = {
          cluster_id: clusterId,
          snapshot_id: snapshotId,
          user_id: userId,
        };
        summaryRows.push({
          ...shared,
          generated_name: name,
          last_activity: c.lastActivity,
          primary_count: c.primaryDocumentIds.length,
          related_count: c.related.length,
          representatives: c.representativeDocumentIds,
          source_count: c.sources.length,
        });
        memberRows.push(
          ...c.primaryDocumentIds.map((document_id) => ({
            ...shared,
            document_id,
            evidence_ids: c.evidenceByDocument[document_id] ?? [],
            role: "primary",
          })),
          ...c.related.map((r) => ({
            ...shared,
            document_id: r.documentId,
            evidence_ids: r.evidenceIds,
            role: "related",
          })),
        );
        sourceRows.push(
          ...c.sources.map((source) => ({
            ...shared,
            document_count: source.documentCount,
            target_key: source.key,
            url: source.url,
          })),
        );
      }
      for (let offset = 0; offset < ids.length; offset += 500)
        await tx
          .insert(ExploreCluster)
          .values(
            ids
              .slice(offset, offset + 500)
              .map((id) => ({ id, user_id: userId })),
          )
          .onConflictDoUpdate({
            set: { retired_at: null },
            target: ExploreCluster.id,
          });
      for (let offset = 0; offset < summaryRows.length; offset += 500)
        await tx
          .insert(ExploreClusterSnapshot)
          .values(summaryRows.slice(offset, offset + 500));
      for (let offset = 0; offset < memberRows.length; offset += 500)
        await tx
          .insert(ExploreClusterMember)
          .values(memberRows.slice(offset, offset + 500));
      for (let offset = 0; offset < sourceRows.length; offset += 500)
        await tx
          .insert(ExploreClusterSource)
          .values(sourceRows.slice(offset, offset + 500));
      const publishedIds = new Set(ids);
      const retired = input.previous
        .filter((p) => !publishedIds.has(p.id))
        .map((p) => p.id);
      if (retired.length)
        await tx
          .update(ExploreCluster)
          .set({ retired_at: sql`now()` })
          .where(
            and(
              eq(ExploreCluster.user_id, userId),
              inArray(ExploreCluster.id, retired),
            ),
          );
      const lineage = clusterLineage(
        overlaps,
        input.previous.map((p) => p.id),
        ids,
      );
      for (let offset = 0; offset < lineage.length; offset += 500)
        await tx
          .insert(ExploreClusterLineage)
          .values(
            lineage.slice(offset, offset + 500).map((row) => ({
              ...row,
              source_revision: input.revision,
              user_id: userId,
            })),
          )
          .onConflictDoNothing();
      await tx
        .update(ExploreState)
        .set({
          active_snapshot_id: snapshotId,
          published_revision: input.revision,
        })
        .where(eq(ExploreState.user_id, userId));
      await tx
        .delete(ExploreRefreshOutbox)
        .where(
          and(
            eq(ExploreRefreshOutbox.user_id, userId),
            eq(ExploreRefreshOutbox.revision, input.revision),
          ),
        );
      await tx
        .delete(ExploreSnapshot)
        .where(
          and(
            eq(ExploreSnapshot.user_id, userId),
            lt(ExploreSnapshot.created_at, sql`now() - interval '24 hours'`),
            sql`${ExploreSnapshot.id} <> ${snapshotId}`,
          ),
        );
      return "published" as const;
    });
    return result;
  } finally {
    await db
      .update(ExploreState)
      .set({ lease_token: null, lease_until: null })
      .where(
        and(
          eq(ExploreState.user_id, userId),
          eq(ExploreState.lease_token, token),
        ),
      );
  }
}
