import { and, asc, count, eq, gt, inArray } from "@acme/db";
import {
  BlockSearchText,
  DocumentReference,
  ExploreClusterMember,
  ExploreClusterSource,
} from "@acme/db/schema";
import { getExternalGraphTitle } from "~/references/graph-utils";
import { encodeExploreCursor } from "./cursor";

import {
  exploreContext,
  metadata,
  loadNotes,
  type Database,
  type ExploreInput,
} from "./query-context";
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
  // Bound each lookup before attaching content; broad multiway joins can scan the
  // entire owner's reference graph under PostgreSQL's generic query plans.
  const references = evidenceIds.length
    ? await database
        .select({
          blockId: DocumentReference.source_block_id,
          documentId: DocumentReference.source_document_id,
          id: DocumentReference.id,
          kind: DocumentReference.target_kind,
        })
        .from(DocumentReference)
        .where(
          and(
            eq(DocumentReference.user_id, userId),
            inArray(DocumentReference.id, evidenceIds),
          ),
        )
    : [];
  const sourceIds = [
    ...new Set(references.map((reference) => reference.documentId)),
  ];
  const sourceBlocks = [
    ...new Set(references.map((reference) => reference.blockId)),
  ];
  const passages = sourceBlocks.length
    ? await database
        .select({
          blockId: BlockSearchText.block_id,
          documentId: BlockSearchText.document_id,
          excerpt: BlockSearchText.search_text,
        })
        .from(BlockSearchText)
        .where(
          and(
            eq(BlockSearchText.user_id, userId),
            inArray(BlockSearchText.block_id, sourceBlocks),
            inArray(BlockSearchText.document_id, sourceIds),
          ),
        )
    : [];
  const sourceNotes = await loadNotes(database, userId, sourceIds);
  const notesById = new Map(sourceNotes.map((note) => [note.id, note]));
  const passagesByBlock = new Map(
    passages.map((passage) => [
      `${passage.documentId}|${passage.blockId}`,
      passage.excerpt,
    ]),
  );
  const byEvidence = new Map(
    references.flatMap((reference) => {
      const note = notesById.get(reference.documentId);
      const excerpt = passagesByBlock.get(
        `${reference.documentId}|${reference.blockId}`,
      );
      return note && excerpt !== undefined
        ? [
            [
              reference.id,
              {
                excerpt: excerpt.slice(0, 240),
                href: `${note.href}#block=${reference.blockId}`,
                id: reference.id,
                kind: reference.kind,
              },
            ] as const,
          ]
        : [];
    }),
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
