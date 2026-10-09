import { and, eq, inArray } from "@acme/db";
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
import { type ReferenceTarget } from "~/references/reference-utils";
import { protectedProcedure } from "../trpc";

import {
  truncate,
  blockText,
  externalPreview,
  resolveInternal,
} from "./reference-api-helpers";

export const referenceNeighborsProcedures = {
  queryNeighbors: protectedProcedure
    .input(
      z.object({
        blockId: z.uuid().optional(),
        cursor: z.string().optional(),
        direction: z.enum(["incoming", "outgoing", "both"]).default("both"),
        documentId: z.uuid(),
        limit: z.number().min(1).max(20).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [seed] = await ctx.db
        .select({ id: Document.id })
        .from(Document)
        .where(
          and(
            eq(Document.id, input.documentId),
            eq(Document.user_id, ctx.session.user.id),
          ),
        )
        .limit(1);
      if (!seed) throw new TRPCError({ code: "NOT_FOUND" });
      const cursorScope = `${input.documentId}|${input.blockId ?? ""}|${input.direction}`;
      let cursorKey: string | undefined;
      if (input.cursor) {
        try {
          const cursor = JSON.parse(
            Buffer.from(input.cursor, "base64url").toString("utf8"),
          ) as { key?: unknown; scope?: unknown };
          if (cursor.scope !== cursorScope || typeof cursor.key !== "string")
            throw new Error();
          cursorKey = cursor.key;
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid cursor",
          });
        }
      }
      const [outgoing, incoming] = await Promise.all([
        input.direction === "incoming"
          ? Promise.resolve([])
          : ctx.db
              .select()
              .from(DocumentReference)
              .where(
                and(
                  eq(DocumentReference.user_id, ctx.session.user.id),
                  eq(DocumentReference.source_document_id, input.documentId),
                  input.blockId
                    ? eq(DocumentReference.source_block_id, input.blockId)
                    : undefined,
                ),
              )
              .limit(1000),
        input.direction === "outgoing"
          ? Promise.resolve([])
          : ctx.db
              .select()
              .from(DocumentReference)
              .where(
                and(
                  eq(DocumentReference.user_id, ctx.session.user.id),
                  eq(DocumentReference.target_document_id, input.documentId),
                  input.blockId
                    ? eq(DocumentReference.target_block_id, input.blockId)
                    : undefined,
                ),
              )
              .limit(1000),
      ]);
      type NeighborGroup = {
        key: string;
        target: ReferenceTarget;
        directions: Set<"incoming" | "outgoing">;
        occurrences: (typeof DocumentReference.$inferSelect)[];
      };
      const neighbors = new Map<string, NeighborGroup>();
      for (const occurrence of outgoing) {
        const target: ReferenceTarget | null =
          occurrence.target_kind === "document" && occurrence.target_document_id
            ? {
                documentId: occurrence.target_document_id,
                kind: "document",
                ...(occurrence.target_block_id
                  ? { blockId: occurrence.target_block_id }
                  : {}),
              }
            : occurrence.target_kind === "external" && occurrence.target_url
              ? { kind: "external", url: occurrence.target_url }
              : null;
        if (!target) continue;
        const key =
          target.kind === "document"
            ? `document:${target.documentId}`
            : occurrence.target_key;
        if (key === `document:${input.documentId}`) continue;
        const group = neighbors.get(key) ?? {
          directions: new Set(),
          key,
          occurrences: [],
          target,
        };
        group.directions.add("outgoing");
        group.occurrences.push(occurrence);
        neighbors.set(key, group);
      }
      for (const occurrence of incoming) {
        if (occurrence.source_document_id === input.documentId) continue;
        const key = `document:${occurrence.source_document_id}`;
        const group = neighbors.get(key) ?? {
          directions: new Set(),
          key,
          occurrences: [],
          target: {
            documentId: occurrence.source_document_id,
            kind: "document",
          },
        };
        group.directions.add("incoming");
        group.occurrences.push(occurrence);
        neighbors.set(key, group);
      }
      const ordered = [...neighbors.values()].sort((a, b) =>
        a.key.localeCompare(b.key),
      );
      const afterCursor = ordered.filter(
        (neighbor) => !cursorKey || neighbor.key > cursorKey,
      );
      const selected = afterCursor.slice(0, input.limit);
      const sourceDocumentIds = [
        ...new Set(
          selected.flatMap((item) =>
            item.occurrences.map((occurrence) => occurrence.source_document_id),
          ),
        ),
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
                id: JournalEntry.id,
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
      const sourceMeta = new Map<
        string,
        { href: string; title: string; kind: "page" | "journal" }
      >();
      for (const page of sourcePages)
        sourceMeta.set(page.documentId, {
          href: `${env.PUBLIC_WEB_URL}/pages/${page.id}`,
          kind: "page",
          title: page.title,
        });
      for (const entry of sourceEntries)
        sourceMeta.set(entry.documentId, {
          href: `${env.PUBLIC_WEB_URL}/journal/${entry.date}`,
          kind: "journal",
          title: entry.date,
        });
      const blockById = new Map(sourceBlocks.map((block) => [block.id, block]));
      const resultNeighbors = await Promise.all(
        selected.map(async (group) => {
          const preview =
            group.target.kind === "external"
              ? await externalPreview(group.target.url, ctx.session.user.id)
              : await resolveInternal(
                  ctx.db,
                  ctx.session.user.id,
                  group.target,
                );
          const occurrences = group.occurrences
            .slice(0, 3)
            .flatMap((occurrence) => {
              const source = sourceMeta.get(occurrence.source_document_id);
              if (!source) return [];
              return [
                {
                  presentation: occurrence.presentation,
                  snippet: truncate(
                    blockText(blockById.get(occurrence.source_block_id)?.data),
                    160,
                  ).text,
                  sourceBlockId: occurrence.source_block_id,
                  sourceDocumentId: occurrence.source_document_id,
                  sourceHref: `${source.href}#block=${occurrence.source_block_id}`,
                  sourceKind: source.kind,
                  sourceTitle: source.title,
                  target: group.target,
                  targetPreview: preview,
                },
              ];
            });
          return {
            directions: [...group.directions],
            key: group.key,
            occurrences,
            preview,
            target: group.target,
          };
        }),
      );
      let bounded = resultNeighbors;
      let truncated = afterCursor.length > input.limit;
      while (
        bounded.length > 0 &&
        Buffer.byteLength(JSON.stringify(bounded), "utf8") > 16 * 1024
      ) {
        bounded = bounded.slice(0, -1);
        truncated = true;
      }
      const last = bounded.at(-1)?.key;
      return {
        neighbors: bounded,
        nextCursor:
          truncated && last
            ? Buffer.from(
                JSON.stringify({ key: last, scope: cursorScope }),
              ).toString("base64url")
            : null,
        seed: await resolveInternal(ctx.db, ctx.session.user.id, {
          documentId: input.documentId,
          kind: "document",
        }),
        truncated,
      };
    }),
} satisfies TRPCRouterRecord;
