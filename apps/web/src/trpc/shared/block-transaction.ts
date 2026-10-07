import { and, eq, inArray, sql } from "@acme/db";
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

const APP_ORIGINS = [new URL(env.PUBLIC_WEB_URL).origin];

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

async function projectReferences(
  db: TRPCContext["db"],
  userId: string,
  documentId: string,
  blocks: BlockNode[],
) {
  const previousReferences = await db
    .select({
      occurrence_path: DocumentReference.occurrence_path,
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
        `${reference.source_block_id}|${reference.occurrence_path}|${reference.target_key}`,
    ),
  );
  const routes = new Map<string, string>();
  const occurrences: (typeof DocumentReference.$inferInsert)[] = [];
  const trustedOrigins = APP_ORIGINS;

  for (const block of blocks) {
    const parsedData = z.record(z.string(), z.unknown()).safeParse(block.data);
    if (!parsedData.success) throw invalidContent();
    const data = parsedData.data;
    validateReferenceProps(data);

    const extracted = extractReferenceOccurrences(data, {
      baseUrl: env.PUBLIC_WEB_URL,
      trustedOrigins,
    });
    for (const occurrence of extracted) {
      let target = occurrence.target;
      if (occurrence.route) {
        const routeKey = `${occurrence.route.kind}:${occurrence.route.kind === "page" ? occurrence.route.entityId : occurrence.route.date}`;
        let resolvedDocumentId = routes.get(routeKey);
        if (!resolvedDocumentId) {
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
            resolvedDocumentId = page?.documentId;
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
            resolvedDocumentId = entry?.documentId;
          }
          if (resolvedDocumentId) routes.set(routeKey, resolvedDocumentId);
        }
        target = resolvedDocumentId
          ? { documentId: resolvedDocumentId, kind: "document" }
          : null;
      }
      if (!target) continue;
      const targetKey = getTargetKey(target);
      if (!targetKey) continue;
      const occurrencePath = `${occurrence.occurrencePath || "/content"}`.slice(
        0,
        256,
      );
      if (target.kind === "document") {
        const [ownedTarget] = await db
          .select({ id: Document.id })
          .from(Document)
          .where(
            and(
              eq(Document.id, target.documentId),
              eq(Document.user_id, userId),
            ),
          )
          .limit(1);
        const wasCommitted = previousKeys.has(
          `${block.id}|${occurrencePath}|${targetKey}`,
        );
        if (!ownedTarget && !wasCommitted) throw invalidContent();
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
      await ctx.db
        .insert(BlockNode)
        .values({
          ...change.args,
          document_id: input.document_id,
          user_id: userId,
        })
        .onConflictDoUpdate({
          set: change.args,
          target: BlockNode.id,
        });
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
  await projectReferences(ctx.db, userId, input.document_id, blocks);
  return document;
}
