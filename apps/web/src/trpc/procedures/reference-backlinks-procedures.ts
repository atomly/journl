import { and, asc, eq, gt, inArray, sql } from "@acme/db";
import {
  BlockNode,
  Document,
  DocumentReference,
  JournalEntry,
  Page,
} from "@acme/db/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { env } from "~/env";
import { protectedProcedure } from "../trpc";

import { truncate, blockText } from "./reference-api-helpers";

export const referenceBacklinksProcedures = {
  listBacklinks: protectedProcedure
    .input(
      z.object({
        blockId: z.uuid().optional(),
        cursor: z.string().optional(),
        documentId: z.uuid(),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [target] = await ctx.db
        .select({ id: Document.id })
        .from(Document)
        .where(
          and(
            eq(Document.id, input.documentId),
            eq(Document.user_id, ctx.session.user.id),
          ),
        )
        .limit(1);
      if (!target) throw new TRPCError({ code: "NOT_FOUND" });
      const cursorScope = JSON.stringify({
        blockId: input.blockId ?? null,
        documentId: input.documentId,
        userId: ctx.session.user.id,
      });
      let after: string | undefined;
      if (input.cursor) {
        try {
          const cursor = JSON.parse(
            Buffer.from(input.cursor, "base64url").toString("utf8"),
          ) as { after?: unknown; scope?: unknown };
          if (
            cursor.scope !== cursorScope ||
            typeof cursor.after !== "string" ||
            !z.uuid().safeParse(cursor.after).success
          )
            throw new Error("Cursor scope mismatch");
          after = cursor.after;
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid cursor",
          });
        }
      }
      const sourcePage = await ctx.db
        .selectDistinct({
          sourceDocumentId: DocumentReference.source_document_id,
        })
        .from(DocumentReference)
        .where(
          and(
            eq(DocumentReference.user_id, ctx.session.user.id),
            eq(DocumentReference.target_document_id, input.documentId),
            input.blockId
              ? eq(DocumentReference.target_block_id, input.blockId)
              : undefined,
            after ? gt(DocumentReference.source_document_id, after) : undefined,
          ),
        )
        .orderBy(asc(DocumentReference.source_document_id))
        .limit(input.limit + 1);
      const selectedIds = sourcePage
        .slice(0, input.limit)
        .map((source) => source.sourceDocumentId);
      const hasMore = sourcePage.length > selectedIds.length;
      const [pages, entries, occurrenceCounts, snippets] = await Promise.all([
        selectedIds.length
          ? ctx.db
              .select({
                documentId: Page.document_id,
                entityId: Page.id,
                title: Page.title,
              })
              .from(Page)
              .where(
                and(
                  eq(Page.user_id, ctx.session.user.id),
                  inArray(Page.document_id, selectedIds),
                ),
              )
          : Promise.resolve([]),
        selectedIds.length
          ? ctx.db
              .select({
                documentId: JournalEntry.document_id,
                entityId: JournalEntry.id,
                title: JournalEntry.date,
              })
              .from(JournalEntry)
              .where(
                and(
                  eq(JournalEntry.user_id, ctx.session.user.id),
                  inArray(JournalEntry.document_id, selectedIds),
                ),
              )
          : Promise.resolve([]),
        selectedIds.length
          ? ctx.db
              .select({
                count: sql<number>`count(*)::int`,
                sourceDocumentId: DocumentReference.source_document_id,
              })
              .from(DocumentReference)
              .where(
                and(
                  eq(DocumentReference.user_id, ctx.session.user.id),
                  eq(DocumentReference.target_document_id, input.documentId),
                  input.blockId
                    ? eq(DocumentReference.target_block_id, input.blockId)
                    : undefined,
                  inArray(DocumentReference.source_document_id, selectedIds),
                ),
              )
              .groupBy(DocumentReference.source_document_id)
          : Promise.resolve([]),
        selectedIds.length
          ? Promise.all(
              selectedIds.map((sourceDocumentId) =>
                ctx.db
                  .select({
                    presentation: DocumentReference.presentation,
                    sourceBlockId: DocumentReference.source_block_id,
                  })
                  .from(DocumentReference)
                  .where(
                    and(
                      eq(DocumentReference.user_id, ctx.session.user.id),
                      eq(
                        DocumentReference.target_document_id,
                        input.documentId,
                      ),
                      eq(
                        DocumentReference.source_document_id,
                        sourceDocumentId,
                      ),
                      input.blockId
                        ? eq(DocumentReference.target_block_id, input.blockId)
                        : undefined,
                    ),
                  )
                  .orderBy(asc(DocumentReference.id))
                  .limit(3),
              ),
            )
          : Promise.resolve([]),
      ]);
      const snippetsBySource = new Map(
        selectedIds.map((id, index) => [id, snippets[index] ?? []]),
      );
      const countsBySource = new Map(
        occurrenceCounts.map((row) => [row.sourceDocumentId, row.count]),
      );
      const snippetBlockIds = [
        ...new Set(
          snippets.flatMap((rows) => rows.map((row) => row.sourceBlockId)),
        ),
      ];
      const sourceBlocks = snippetBlockIds.length
        ? await ctx.db
            .select()
            .from(BlockNode)
            .where(
              and(
                eq(BlockNode.user_id, ctx.session.user.id),
                inArray(BlockNode.id, snippetBlockIds),
              ),
            )
        : [];
      const sourceTitle = new Map<
        string,
        { href: string; kind: "page" | "journal"; title: string }
      >();
      for (const page of pages) {
        sourceTitle.set(page.documentId, {
          href: `${env.PUBLIC_WEB_URL}/pages/${page.entityId}`,
          kind: "page",
          title: page.title,
        });
      }
      for (const entry of entries) {
        sourceTitle.set(entry.documentId, {
          href: `${env.PUBLIC_WEB_URL}/journal/${entry.title}`,
          kind: "journal",
          title: entry.title,
        });
      }
      const blockById = new Map(sourceBlocks.map((block) => [block.id, block]));
      const items = selectedIds.flatMap((sourceDocumentId) => {
        const title = sourceTitle.get(sourceDocumentId);
        const sourceSnippets = snippetsBySource.get(sourceDocumentId) ?? [];
        if (!title) return [];
        const sourceOccurrences = sourceSnippets.map((occurrence) => ({
          href: `${title.href}#block=${occurrence.sourceBlockId}`,
          presentation: occurrence.presentation,
          snippet: truncate(
            blockText(blockById.get(occurrence.sourceBlockId)?.data),
            160,
          ).text,
          sourceBlockId: occurrence.sourceBlockId,
        }));
        return [
          {
            documentId: sourceDocumentId,
            href: title.href,
            kind: title.kind,
            occurrenceCount: countsBySource.get(sourceDocumentId) ?? 0,
            snippets: sourceOccurrences,
            title: title.title,
          },
        ];
      });
      const last = selectedIds.at(-1);
      return {
        items,
        nextCursor:
          hasMore && last
            ? Buffer.from(
                JSON.stringify({ after: last, scope: cursorScope }),
              ).toString("base64url")
            : null,
      };
    }),
  listOccurrences: protectedProcedure
    .input(
      z.object({
        blockId: z.uuid().optional(),
        cursor: z.string().optional(),
        direction: z.enum(["incoming", "outgoing"]),
        documentId: z.uuid(),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [owned] = await ctx.db
        .select({ id: Document.id })
        .from(Document)
        .where(
          and(
            eq(Document.id, input.documentId),
            eq(Document.user_id, ctx.session.user.id),
          ),
        )
        .limit(1);
      if (!owned) throw new TRPCError({ code: "NOT_FOUND" });
      const matches = await ctx.db
        .select()
        .from(DocumentReference)
        .where(
          and(
            eq(DocumentReference.user_id, ctx.session.user.id),
            input.direction === "outgoing"
              ? eq(DocumentReference.source_document_id, input.documentId)
              : eq(DocumentReference.target_document_id, input.documentId),
            input.blockId
              ? input.direction === "outgoing"
                ? eq(DocumentReference.source_block_id, input.blockId)
                : eq(DocumentReference.target_block_id, input.blockId)
              : undefined,
            input.cursor ? gt(DocumentReference.id, input.cursor) : undefined,
          ),
        )
        .orderBy(asc(DocumentReference.id))
        .limit(input.limit + 1);
      const page = matches.slice(0, input.limit);
      const sourceDocumentIds = [
        ...new Set(page.map((item) => item.source_document_id)),
      ];
      const [sourcePages, sourceEntries, sourceBlocks] = await Promise.all([
        sourceDocumentIds.length
          ? ctx.db
              .select({
                documentId: Page.document_id,
                id: Page.id,
                title: Page.title,
              })
              .from(Page)
              .where(
                and(
                  eq(Page.user_id, ctx.session.user.id),
                  inArray(Page.document_id, sourceDocumentIds),
                ),
              )
          : Promise.resolve([]),
        sourceDocumentIds.length
          ? ctx.db
              .select({
                date: JournalEntry.date,
                documentId: JournalEntry.document_id,
              })
              .from(JournalEntry)
              .where(
                and(
                  eq(JournalEntry.user_id, ctx.session.user.id),
                  inArray(JournalEntry.document_id, sourceDocumentIds),
                ),
              )
          : Promise.resolve([]),
        sourceDocumentIds.length
          ? ctx.db
              .select()
              .from(BlockNode)
              .where(
                and(
                  eq(BlockNode.user_id, ctx.session.user.id),
                  inArray(BlockNode.document_id, sourceDocumentIds),
                ),
              )
          : Promise.resolve([]),
      ]);
      const sourceMeta = new Map<string, { href: string; title: string }>();
      for (const source of sourcePages)
        sourceMeta.set(source.documentId, {
          href: `${env.PUBLIC_WEB_URL}/pages/${source.id}`,
          title: source.title,
        });
      for (const source of sourceEntries)
        sourceMeta.set(source.documentId, {
          href: `${env.PUBLIC_WEB_URL}/journal/${source.date}`,
          title: source.date,
        });
      const blocksById = new Map(
        sourceBlocks.map((block) => [block.id, block]),
      );
      const items = page.map((item) => {
        const source = sourceMeta.get(item.source_document_id);
        const text = blockText(blocksById.get(item.source_block_id)?.data);
        return {
          ...item,
          snippet: truncate(text, 160).text,
          sourceHref: source
            ? `${source.href}#block=${item.source_block_id}`
            : undefined,
          sourceTitle: source?.title,
        };
      });
      return {
        items,
        nextCursor:
          matches.length > input.limit
            ? (matches[input.limit]?.id ?? null)
            : null,
      };
    }),
} satisfies TRPCRouterRecord;
