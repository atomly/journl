import { and, asc, eq, inArray, sql } from "@acme/db";
import {
  BlockEdge,
  BlockNode,
  BlockSearchText,
  Document,
  DocumentReference,
  JournalEntry,
  Page,
  zInsertBlockEdge,
  zInsertBlockNode,
} from "@acme/db/schema";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { env } from "~/env";
import {
  extractReferenceOccurrences,
  getTargetKey,
  zReferenceProps,
} from "~/references/reference-utils";
import type { TRPCContext } from "../trpc";

export const zBlockTransactions = z.object({
  document_id: z.uuid(),
  transactions: z.array(
    z.discriminatedUnion("type", [
      z.object({
        args: zInsertBlockEdge.pick({
          from_id: true,
          to_id: true,
        }),
        type: z.literal("edge_remove"),
      }),
      z.object({
        args: zInsertBlockEdge.omit({
          document_id: true,
          user_id: true,
        }),
        type: z.literal("edge_insert"),
      }),
      z.object({
        args: zInsertBlockNode.omit({
          document_id: true,
          user_id: true,
        }),
        type: z.literal("block_upsert"),
      }),
      z.object({
        args: zInsertBlockNode.pick({ id: true }),
        type: z.literal("block_remove"),
      }),
    ]),
  ),
});

const APP_ORIGINS = (() => {
  try {
    return [new URL(env.PUBLIC_WEB_URL).origin];
  } catch {
    return [];
  }
})();

function invalidContent() {
  return new TRPCError({
    code: "BAD_REQUEST",
    message: "The document contains an invalid content reference.",
  });
}

function authoredText(value: unknown): string {
  if (Array.isArray(value)) return value.map(authoredText).join(" ");
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (record.type === "codeBlock") return "";
  if (
    record.type === "contentReference" ||
    record.type === "referenceCard" ||
    record.type === "contentEmbed"
  ) {
    const props = zReferenceProps.safeParse(record.props);
    return props.success ? props.data.label : "";
  }
  if (record.type === "text" && typeof record.text === "string") {
    return record.text;
  }
  return ["content", "rows", "cells"]
    .map((key) => authoredText(record[key]))
    .filter(Boolean)
    .join(" ");
}

export async function rebuildReferenceProjection(
  db: TRPCContext["db"],
  userId: string,
  documentId: string,
  blocks: BlockNode[],
  strictReferences = true,
) {
  const previousReferences = await db
    .select({
      occurrence_path: DocumentReference.occurrence_path,
      presentation: DocumentReference.presentation,
      source_block_id: DocumentReference.source_block_id,
      target_key: DocumentReference.target_key,
    })
    .from(DocumentReference)
    .where(
      and(
        eq(DocumentReference.user_id, userId),
        eq(DocumentReference.source_document_id, documentId),
      ),
    );
  const previousKeys = new Set(
    previousReferences.map(
      (reference) =>
        `${reference.source_block_id}|${reference.occurrence_path}|${reference.target_key}|${reference.presentation}`,
    ),
  );
  const occurrences: (typeof DocumentReference.$inferInsert)[] = [];
  let malformedCount = 0;
  let unresolvedRouteCount = 0;
  const trustedOrigins = APP_ORIGINS;
  const extractedBlocks = blocks.map((block) => {
    const parsedData = z.record(z.string(), z.unknown()).safeParse(block.data);
    if (!parsedData.success) throw invalidContent();
    if (strictReferences) {
      validateReferenceProps(parsedData.data);
    } else {
      malformedCount += countMalformedReferenceProps(parsedData.data);
    }
    return {
      block,
      occurrences: extractReferenceOccurrences(parsedData.data, {
        baseUrl: env.PUBLIC_WEB_URL,
        trustedOrigins,
      }),
    };
  });

  const routeTargets = new Map<string, string | null>();
  const targetDocumentIds = new Set<string>();
  for (const { occurrences: extracted } of extractedBlocks) {
    for (const occurrence of extracted) {
      if (occurrence.target?.kind === "document") {
        targetDocumentIds.add(occurrence.target.documentId);
      }
      if (!occurrence.route) continue;
      const routeKey = `${occurrence.route.kind}:${occurrence.route.kind === "page" ? occurrence.route.entityId : occurrence.route.date}`;
      if (routeTargets.has(routeKey)) continue;
      let resolvedDocumentId: string | undefined;
      if (occurrence.route.kind === "page") {
        const [page] = await db
          .select({ documentId: Page.document_id })
          .from(Page)
          .where(
            and(
              eq(Page.id, occurrence.route.entityId),
              eq(Page.user_id, userId),
            ),
          )
          .limit(1);
        if (page) {
          const [journalMapping] = await db
            .select({ id: JournalEntry.id })
            .from(JournalEntry)
            .where(
              and(
                eq(JournalEntry.document_id, page.documentId),
                eq(JournalEntry.user_id, userId),
              ),
            )
            .limit(1);
          if (!journalMapping) resolvedDocumentId = page.documentId;
        }
      } else {
        const [entry] = await db
          .select({ documentId: JournalEntry.document_id })
          .from(JournalEntry)
          .where(
            and(
              eq(JournalEntry.date, occurrence.route.date),
              eq(JournalEntry.user_id, userId),
            ),
          )
          .limit(1);
        if (entry) {
          const [pageMapping] = await db
            .select({ id: Page.id })
            .from(Page)
            .where(
              and(
                eq(Page.document_id, entry.documentId),
                eq(Page.user_id, userId),
              ),
            )
            .limit(1);
          if (!pageMapping) resolvedDocumentId = entry.documentId;
        }
      }
      if (resolvedDocumentId) {
        routeTargets.set(routeKey, resolvedDocumentId);
        targetDocumentIds.add(resolvedDocumentId);
      } else {
        routeTargets.set(routeKey, null);
      }
    }
  }

  // Lock every existing target document in UUID order before validating block
  // membership or writing projections. Deletes and block removals take an
  // UPDATE lock on their source document, so reciprocal references serialize
  // without acquiring target locks in content order.
  const lockedTargetIds =
    targetDocumentIds.size > 0
      ? new Set(
          (
            await db
              .select({ id: Document.id })
              .from(Document)
              .where(
                and(
                  eq(Document.user_id, userId),
                  inArray(Document.id, [...targetDocumentIds]),
                ),
              )
              .orderBy(asc(Document.id))
              .for("key share")
          ).map((document) => document.id),
        )
      : new Set<string>();

  for (const { block, occurrences: extracted } of extractedBlocks) {
    for (const occurrence of extracted) {
      let target = occurrence.target;
      if (occurrence.route) {
        const routeKey = `${occurrence.route.kind}:${occurrence.route.kind === "page" ? occurrence.route.entityId : occurrence.route.date}`;
        const resolvedDocumentId = routeTargets.get(routeKey) ?? undefined;
        target =
          resolvedDocumentId && lockedTargetIds.has(resolvedDocumentId)
            ? {
                documentId: resolvedDocumentId,
                kind: "document",
                ...(occurrence.route.blockId
                  ? { blockId: occurrence.route.blockId }
                  : {}),
              }
            : null;
        if (!resolvedDocumentId || !lockedTargetIds.has(resolvedDocumentId)) {
          unresolvedRouteCount += 1;
        }
      }
      if (!target) continue;
      const targetKey = getTargetKey(target);
      if (!targetKey) continue;
      const occurrencePath = `${occurrence.occurrencePath || "/content"}`.slice(
        0,
        256,
      );
      const wasCommitted = previousKeys.has(
        `${block.id}|${occurrencePath}|${targetKey}|${occurrence.presentation}`,
      );
      if (
        strictReferences &&
        !env.CONTENT_REFERENCES_ENABLED &&
        occurrence.presentation !== "link" &&
        !wasCommitted
      ) {
        throw invalidContent();
      }
      if (target.kind === "document") {
        if (!lockedTargetIds.has(target.documentId) && !wasCommitted)
          throw invalidContent();
        if (target.blockId) {
          const [ownedBlock] = await db
            .select({ id: BlockNode.id })
            .from(BlockNode)
            .where(
              and(
                eq(BlockNode.id, target.blockId),
                eq(BlockNode.document_id, target.documentId),
                eq(BlockNode.user_id, userId),
              ),
            )
            .limit(1);
          if (!ownedBlock && occurrence.route) continue;
          if (!ownedBlock && !wasCommitted) throw invalidContent();
        }
      }
      occurrences.push({
        occurrence_path: occurrencePath,
        presentation: occurrence.presentation,
        source_block_id: block.id,
        source_document_id: documentId,
        target_block_id:
          target.kind === "document" ? (target.blockId ?? null) : null,
        target_document_id:
          target.kind === "document" ? target.documentId : null,
        target_identity: occurrence.identity,
        target_key: targetKey,
        target_kind: target.kind,
        target_url: target.kind === "external" ? target.url : null,
        user_id: userId,
      });
    }
  }

  await db
    .delete(DocumentReference)
    .where(
      and(
        eq(DocumentReference.user_id, userId),
        eq(DocumentReference.source_document_id, documentId),
      ),
    );
  if (occurrences.length > 0) {
    await db.insert(DocumentReference).values(occurrences);
  }

  await db
    .delete(BlockSearchText)
    .where(
      and(
        eq(BlockSearchText.user_id, userId),
        eq(BlockSearchText.document_id, documentId),
      ),
    );
  if (blocks.length > 0) {
    await db.insert(BlockSearchText).values(
      blocks.map((block) => ({
        block_id: block.id,
        document_id: documentId,
        search_text: authoredText(block.data).slice(0, 20_000),
        user_id: userId,
      })),
    );
  }
  return {
    blockSearchTextCount: blocks.length,
    malformedCount,
    referenceCount: occurrences.length,
    unresolvedRouteCount,
  };
}

function countMalformedReferenceProps(value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce(
      (count, child) => count + countMalformedReferenceProps(child),
      0,
    );
  }
  if (!value || typeof value !== "object") return 0;
  const record = value as Record<string, unknown>;
  if (record.type === "codeBlock") return 0;
  const customType =
    record.type === "contentReference" ||
    record.type === "referenceCard" ||
    record.type === "contentEmbed";
  const invalidCustom =
    customType && !zReferenceProps.safeParse(record.props).success ? 1 : 0;
  return (
    invalidCustom +
    ["content", "rows", "cells"].reduce(
      (count, key) => count + countMalformedReferenceProps(record[key]),
      0,
    )
  );
}

function validateReferenceProps(value: unknown) {
  if (Array.isArray(value)) {
    for (const item of value) validateReferenceProps(item);
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (
    record.type === "contentReference" ||
    record.type === "referenceCard" ||
    record.type === "contentEmbed"
  ) {
    const props = zReferenceProps.safeParse(record.props);
    if (!props.success) throw invalidContent();
    if (
      record.type === "contentEmbed" &&
      props.data.targetKind !== "document"
    ) {
      throw invalidContent();
    }
  }
  if (record.type === "codeBlock") return;
  for (const key of ["content", "rows", "cells"]) {
    if (key in record) validateReferenceProps(record[key]);
  }
}

/**
 * Saves and projects a complete final block snapshot in the caller's transaction.
 * Callers must start a transaction before invoking this helper.
 */
export async function saveTransactions(
  ctx: TRPCContext,
  input: z.infer<typeof zBlockTransactions>,
) {
  const userId = ctx.session?.user?.id;
  if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

  const [source] = await ctx.db
    .select({ id: Document.id })
    .from(Document)
    .where(
      and(eq(Document.id, input.document_id), eq(Document.user_id, userId)),
    )
    .for("update");
  if (!source)
    throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });

  for (const change of input.transactions) {
    if (change.type === "edge_remove") {
      await ctx.db
        .delete(BlockEdge)
        .where(
          and(
            eq(BlockEdge.user_id, userId),
            eq(BlockEdge.document_id, input.document_id),
            eq(BlockEdge.from_id, change.args.from_id),
            eq(BlockEdge.to_id, change.args.to_id),
          ),
        );
      continue;
    }

    if (change.type === "block_remove") {
      const documentBlocks = await ctx.db
        .select({ id: BlockNode.id, parent_id: BlockNode.parent_id })
        .from(BlockNode)
        .where(
          and(
            eq(BlockNode.user_id, userId),
            eq(BlockNode.document_id, input.document_id),
          ),
        );
      const removedIds = new Set([change.args.id]);
      let added = true;
      while (added) {
        added = false;
        for (const block of documentBlocks) {
          if (block.parent_id && removedIds.has(block.parent_id)) {
            if (!removedIds.has(block.id)) {
              removedIds.add(block.id);
              added = true;
            }
          }
        }
      }
      await ctx.db
        .delete(DocumentReference)
        .where(
          and(
            eq(DocumentReference.user_id, userId),
            eq(DocumentReference.target_document_id, input.document_id),
            eq(DocumentReference.target_identity, "route"),
            inArray(DocumentReference.target_block_id, [...removedIds]),
          ),
        );
      await ctx.db
        .delete(BlockNode)
        .where(
          and(
            eq(BlockNode.user_id, userId),
            eq(BlockNode.document_id, input.document_id),
            eq(BlockNode.id, change.args.id),
          ),
        );
      continue;
    }

    if (change.type === "block_upsert") {
      const [existing] = await ctx.db
        .select({ id: BlockNode.id })
        .from(BlockNode)
        .where(eq(BlockNode.id, change.args.id))
        .limit(1);
      if (existing) {
        const [owned] = await ctx.db
          .select({ id: BlockNode.id })
          .from(BlockNode)
          .where(
            and(
              eq(BlockNode.id, change.args.id),
              eq(BlockNode.user_id, userId),
              eq(BlockNode.document_id, input.document_id),
            ),
          )
          .limit(1);
        if (!owned) throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (change.args.parent_id) {
        const [parent] = await ctx.db
          .select({ id: BlockNode.id })
          .from(BlockNode)
          .where(
            and(
              eq(BlockNode.id, change.args.parent_id),
              eq(BlockNode.user_id, userId),
              eq(BlockNode.document_id, input.document_id),
            ),
          )
          .limit(1);
        if (!parent) throw new TRPCError({ code: "BAD_REQUEST" });
      }
      const [upserted] = await ctx.db
        .insert(BlockNode)
        .values({
          ...change.args,
          document_id: input.document_id,
          user_id: userId,
        })
        .onConflictDoUpdate({
          set: change.args,
          setWhere: and(
            eq(BlockNode.user_id, userId),
            eq(BlockNode.document_id, input.document_id),
          ),
          target: BlockNode.id,
        })
        .returning({ id: BlockNode.id });
      if (!upserted) throw new TRPCError({ code: "FORBIDDEN" });
      continue;
    }

    if (change.type === "edge_insert") {
      const endpoints = await ctx.db
        .select({ id: BlockNode.id })
        .from(BlockNode)
        .where(
          and(
            inArray(BlockNode.id, [change.args.from_id, change.args.to_id]),
            eq(BlockNode.user_id, userId),
            eq(BlockNode.document_id, input.document_id),
          ),
        );
      if (endpoints.length !== 2) throw new TRPCError({ code: "BAD_REQUEST" });
      await ctx.db.insert(BlockEdge).values({
        document_id: input.document_id,
        from_id: change.args.from_id,
        to_id: change.args.to_id,
        type: change.args.type,
        user_id: userId,
      });
    }
  }

  const [document] = await ctx.db
    .update(Document)
    .set({ updated_at: sql`now()` })
    .where(
      and(eq(Document.id, input.document_id), eq(Document.user_id, userId)),
    )
    .returning({ id: Document.id, updatedAt: Document.updated_at });
  if (!document)
    throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });

  const blocks = await ctx.db
    .select()
    .from(BlockNode)
    .where(
      and(
        eq(BlockNode.user_id, userId),
        eq(BlockNode.document_id, input.document_id),
      ),
    );
  await rebuildReferenceProjection(ctx.db, userId, input.document_id, blocks);
  return document;
}
