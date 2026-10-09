import { createHash } from "node:crypto";
import { and, asc, eq, gt, inArray, or } from "@acme/db";
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
import {
  getExternalGraphTitle,
  getGraphDocumentTargetKey,
} from "~/references/graph-utils";
import { type ReferenceTarget } from "~/references/reference-utils";
import { protectedProcedure } from "../trpc";

import {
  truncate,
  blockText,
  createGraphSourceExcerpt,
  addGraphOccurrence,
  type GraphSourceExcerpt,
} from "./reference-api-helpers";

export const referenceGraphProcedures = {
  getGraph: protectedProcedure
    .input(
      z
        .object({
          cursor: z.string().optional(),
          limit: z.number().min(1).max(200).default(100),
          seedBlockId: z.uuid().optional(),
          seedDocumentId: z.uuid().optional(),
          types: z
            .array(z.enum(["page", "journal", "block", "external"]))
            .optional(),
        })
        .refine((input) => !input.seedBlockId || input.seedDocumentId, {
          message: "A block seed requires a document seed",
        }),
    )
    .query(async ({ ctx, input }) => {
      const typeFilter = new Set(
        input.types ?? ["page", "journal", "block", "external"],
      );
      const pageSize = Math.min(50, input.limit);
      const scope = JSON.stringify({
        seedBlockId: input.seedBlockId ?? null,
        seedDocumentId: input.seedDocumentId ?? null,
        types: [...typeFilter].sort(),
        userId: ctx.session.user.id,
      });
      let documentAfter: string | undefined;
      let referenceAfter: string | undefined;
      if (input.cursor) {
        try {
          const cursor = JSON.parse(
            Buffer.from(input.cursor, "base64url").toString("utf8"),
          ) as {
            documentAfter?: unknown;
            referenceAfter?: unknown;
            scope?: unknown;
          };
          if (
            cursor.scope !== scope ||
            (cursor.documentAfter !== undefined &&
              (typeof cursor.documentAfter !== "string" ||
                !z.uuid().safeParse(cursor.documentAfter).success)) ||
            (cursor.referenceAfter !== undefined &&
              (typeof cursor.referenceAfter !== "string" ||
                !z.uuid().safeParse(cursor.referenceAfter).success))
          )
            throw new Error();
          documentAfter = cursor.documentAfter as string | undefined;
          referenceAfter = cursor.referenceAfter as string | undefined;
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid cursor",
          });
        }
      }
      if (input.seedDocumentId) {
        const [seed] = await ctx.db
          .select({ id: Document.id })
          .from(Document)
          .where(
            and(
              eq(Document.id, input.seedDocumentId),
              eq(Document.user_id, ctx.session.user.id),
            ),
          )
          .limit(1);
        if (!seed) throw new TRPCError({ code: "NOT_FOUND" });
        if (input.seedBlockId) {
          const [block] = await ctx.db
            .select({ id: BlockNode.id })
            .from(BlockNode)
            .where(
              and(
                eq(BlockNode.id, input.seedBlockId),
                eq(BlockNode.document_id, input.seedDocumentId),
                eq(BlockNode.user_id, ctx.session.user.id),
              ),
            )
            .limit(1);
          if (!block) throw new TRPCError({ code: "NOT_FOUND" });
        }
      }
      // Keep each response bounded while advancing over the entire owner-scoped
      // document and occurrence sets. A page has at most 50 standalone
      // documents and 50 occurrences; each occurrence can add no more than
      // three nodes (source, target, and block), keeping the node ceiling at
      // 200 without silently clipping rows before the cursor advances.
      const documentPage = input.seedDocumentId
        ? []
        : await ctx.db
            .select({ id: Document.id })
            .from(Document)
            .where(
              and(
                eq(Document.user_id, ctx.session.user.id),
                documentAfter ? gt(Document.id, documentAfter) : undefined,
              ),
            )
            .orderBy(asc(Document.id))
            .limit(pageSize + 1);
      const ownedDocuments = documentPage.slice(0, pageSize);
      const hasMoreDocuments = documentPage.length > ownedDocuments.length;
      const ownedIds = input.seedDocumentId
        ? [input.seedDocumentId]
        : ownedDocuments.map((document) => document.id);
      const [pages, entries] = await Promise.all([
        ownedIds.length
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
                  inArray(Page.document_id, ownedIds),
                ),
              )
          : Promise.resolve([]),
        ownedIds.length
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
                  inArray(JournalEntry.document_id, ownedIds),
                ),
              )
          : Promise.resolve([]),
      ]);
      const docs = new Map<
        string,
        { href: string; kind: "page" | "journal"; title: string }
      >();
      for (const page of pages)
        docs.set(page.documentId, {
          href: `${env.PUBLIC_WEB_URL}/pages/${page.id}`,
          kind: "page",
          title: truncate(page.title, 160).text,
        });
      for (const entry of entries)
        docs.set(entry.documentId, {
          href: `${env.PUBLIC_WEB_URL}/journal/${entry.date}`,
          kind: "journal",
          title: entry.date,
        });
      const occurrenceScope = input.seedDocumentId
        ? or(
            and(
              eq(DocumentReference.source_document_id, input.seedDocumentId),
              input.seedBlockId
                ? eq(DocumentReference.source_block_id, input.seedBlockId)
                : undefined,
            ),
            and(
              eq(DocumentReference.target_document_id, input.seedDocumentId),
              input.seedBlockId
                ? eq(DocumentReference.target_block_id, input.seedBlockId)
                : undefined,
            ),
          )
        : undefined;
      const occurrencePage = await ctx.db
        .select()
        .from(DocumentReference)
        .where(
          and(
            eq(DocumentReference.user_id, ctx.session.user.id),
            occurrenceScope,
            referenceAfter
              ? gt(DocumentReference.id, referenceAfter)
              : undefined,
          ),
        )
        .orderBy(asc(DocumentReference.id))
        .limit(pageSize + 1);
      const allOccurrences = occurrencePage.slice(0, pageSize);
      const hasMoreOccurrences = occurrencePage.length > allOccurrences.length;
      const adjacentDocumentIds = [
        ...new Set(
          allOccurrences.flatMap((occurrence) => [
            occurrence.source_document_id,
            ...(occurrence.target_document_id
              ? [occurrence.target_document_id]
              : []),
          ]),
        ),
      ];
      if (adjacentDocumentIds.length > 0) {
        const [adjacentPages, adjacentEntries] = await Promise.all([
          ctx.db
            .select({
              documentId: Page.document_id,
              id: Page.id,
              title: Page.title,
            })
            .from(Page)
            .where(
              and(
                eq(Page.user_id, ctx.session.user.id),
                inArray(Page.document_id, adjacentDocumentIds),
              ),
            ),
          ctx.db
            .select({
              date: JournalEntry.date,
              documentId: JournalEntry.document_id,
            })
            .from(JournalEntry)
            .where(
              and(
                eq(JournalEntry.user_id, ctx.session.user.id),
                inArray(JournalEntry.document_id, adjacentDocumentIds),
              ),
            ),
        ]);
        for (const page of adjacentPages)
          docs.set(page.documentId, {
            href: `${env.PUBLIC_WEB_URL}/pages/${page.id}`,
            kind: "page",
            title: truncate(page.title, 160).text,
          });
        for (const entry of adjacentEntries)
          docs.set(entry.documentId, {
            href: `${env.PUBLIC_WEB_URL}/journal/${entry.date}`,
            kind: "journal",
            title: entry.date,
          });
      }
      const graphBlockIds = [
        ...new Set(
          allOccurrences.flatMap((occurrence) => [
            occurrence.source_block_id,
            ...(occurrence.target_block_id ? [occurrence.target_block_id] : []),
          ]),
        ),
      ];
      const graphBlocks = graphBlockIds.length
        ? await ctx.db
            .select({
              data: BlockNode.data,
              document_id: BlockNode.document_id,
              id: BlockNode.id,
              user_id: BlockNode.user_id,
            })
            .from(BlockNode)
            .where(
              and(
                eq(BlockNode.user_id, ctx.session.user.id),
                inArray(BlockNode.id, graphBlockIds),
              ),
            )
        : [];
      const graphBlockById = new Map(
        graphBlocks.map((block) => [block.id, block]),
      );
      const documentDates = docs.size
        ? await ctx.db
            .select({ id: Document.id, updatedAt: Document.updated_at })
            .from(Document)
            .where(
              and(
                eq(Document.user_id, ctx.session.user.id),
                inArray(Document.id, [...docs.keys()]),
              ),
            )
        : [];
      const documentUpdatedAt = new Map(
        documentDates.map((document) => [document.id, document.updatedAt]),
      );
      type GraphNode = {
        key: string;
        target?: ReferenceTarget;
        title: string;
        href?: string;
        updatedAt?: string;
        kind: "page" | "journal" | "block" | "external" | "unavailable";
      };
      const nodes = new Map<string, GraphNode>();
      for (const [documentId, note] of docs) {
        if (!typeFilter.has(note.kind)) continue;
        const key = `document:${documentId}`;
        if (
          input.seedDocumentId &&
          documentId !== input.seedDocumentId &&
          !allOccurrences.some(
            (occurrence) =>
              occurrence.source_document_id === documentId ||
              occurrence.target_document_id === documentId,
          )
        )
          continue;
        nodes.set(key, {
          href: note.href,
          key,
          kind: note.kind,
          target: { documentId, kind: "document" },
          title: note.title,
          updatedAt: documentUpdatedAt.get(documentId),
        });
      }
      const edgeMap = new Map<
        string,
        {
          fromKey: string;
          toKey: string;
          occurrenceCount: number;
          occurrenceIds: string[];
          presentations: Set<string>;
          sources: GraphSourceExcerpt[];
          sourceBlocks: string[];
        }
      >();
      for (const occurrence of allOccurrences) {
        const fromKey = `document:${occurrence.source_document_id}`;
        let toKey = occurrence.target_key;
        let target: ReferenceTarget | null = null;
        if (
          occurrence.target_kind === "document" &&
          occurrence.target_document_id
        ) {
          target = {
            documentId: occurrence.target_document_id,
            kind: "document",
            ...(occurrence.target_block_id
              ? { blockId: occurrence.target_block_id }
              : {}),
          };
          toKey = getGraphDocumentTargetKey(target, typeFilter.has("block"));
          if (occurrence.target_block_id && typeFilter.has("block")) {
            const note = docs.get(occurrence.target_document_id);
            const block = graphBlockById.get(occurrence.target_block_id);
            if (
              block &&
              note &&
              block.document_id === occurrence.target_document_id
            )
              nodes.set(toKey, {
                href: `${note.href}#block=${occurrence.target_block_id}`,
                key: toKey,
                kind: "block",
                target,
                title: truncate(
                  `${note.title} · ${truncate(blockText(block.data), 80).text || "Block"}`,
                  160,
                ).text,
              });
          }
          if (!nodes.has(`document:${occurrence.target_document_id}`)) {
            const [ownedTarget] = await ctx.db
              .select({ id: Document.id })
              .from(Document)
              .where(
                and(
                  eq(Document.id, occurrence.target_document_id),
                  eq(Document.user_id, ctx.session.user.id),
                ),
              )
              .limit(1);
            if (ownedTarget) {
              const [page] = await ctx.db
                .select({
                  documentId: Page.document_id,
                  id: Page.id,
                  title: Page.title,
                })
                .from(Page)
                .where(
                  and(
                    eq(Page.document_id, ownedTarget.id),
                    eq(Page.user_id, ctx.session.user.id),
                  ),
                )
                .limit(1);
              const [entry] = await ctx.db
                .select({
                  date: JournalEntry.date,
                  documentId: JournalEntry.document_id,
                })
                .from(JournalEntry)
                .where(
                  and(
                    eq(JournalEntry.document_id, ownedTarget.id),
                    eq(JournalEntry.user_id, ctx.session.user.id),
                  ),
                )
                .limit(1);
              if (page)
                nodes.set(`document:${ownedTarget.id}`, {
                  href: `${env.PUBLIC_WEB_URL}/pages/${page.id}`,
                  key: `document:${ownedTarget.id}`,
                  kind: "page",
                  target: { documentId: ownedTarget.id, kind: "document" },
                  title: truncate(page.title, 160).text,
                });
              if (entry)
                nodes.set(`document:${ownedTarget.id}`, {
                  href: `${env.PUBLIC_WEB_URL}/journal/${entry.date}`,
                  key: `document:${ownedTarget.id}`,
                  kind: "journal",
                  target: { documentId: ownedTarget.id, kind: "document" },
                  title: entry.date,
                });
            } else {
              const anonymousKey = `unavailable:${createHash("sha256").update(`${ctx.session.user.id}:${occurrence.target_key}`).digest("hex")}`;
              toKey = anonymousKey;
              nodes.set(anonymousKey, {
                key: anonymousKey,
                kind: "unavailable",
                title: "Content unavailable",
              });
            }
          }
        } else if (
          occurrence.target_kind === "external" &&
          occurrence.target_url
        ) {
          const title = getExternalGraphTitle(occurrence.target_url);
          const externalKey = `external:${createHash("sha256").update(occurrence.target_url).digest("hex")}`;
          toKey = externalKey;
          if (typeFilter.has("external"))
            nodes.set(externalKey, {
              href: occurrence.target_url,
              key: externalKey,
              kind: "external",
              target: { kind: "external", url: occurrence.target_url },
              title: truncate(title, 160).text,
            });
        }
        if (
          !docs.has(occurrence.source_document_id) ||
          !nodes.has(fromKey) ||
          !nodes.has(toKey)
        )
          continue;
        const edgeKey = `${fromKey}|${toKey}`;
        const edge = edgeMap.get(edgeKey) ?? {
          fromKey,
          occurrenceCount: 0,
          occurrenceIds: [],
          presentations: new Set<string>(),
          sourceBlocks: [],
          sources: [],
          toKey,
        };
        const sourceExcerpt = createGraphSourceExcerpt(
          occurrence,
          graphBlockById.get(occurrence.source_block_id),
          docs.get(occurrence.source_document_id),
          ctx.session.user.id,
        );
        addGraphOccurrence(edge, occurrence, sourceExcerpt);
        edgeMap.set(edgeKey, edge);
      }
      const selectedNodes = [...nodes.values()]
        .filter(
          (node) => node.kind === "unavailable" || typeFilter.has(node.kind),
        )
        .sort((a, b) => a.key.localeCompare(b.key))
        .slice(0, 200);
      const selectedKeys = new Set(selectedNodes.map((node) => node.key));
      const edges = [...edgeMap.values()]
        .filter(
          (edge) =>
            selectedKeys.has(edge.fromKey) && selectedKeys.has(edge.toKey),
        )
        .slice(0, 500)
        .map((edge) => ({ ...edge, presentations: [...edge.presentations] }));
      const hasMore = hasMoreDocuments || hasMoreOccurrences;
      const nextDocumentAfter = ownedDocuments.at(-1)?.id ?? documentAfter;
      const nextReferenceAfter = allOccurrences.at(-1)?.id ?? referenceAfter;
      return {
        edges,
        nextCursor: hasMore
          ? Buffer.from(
              JSON.stringify({
                documentAfter: nextDocumentAfter,
                referenceAfter: nextReferenceAfter,
                scope,
              }),
            ).toString("base64url")
          : null,
        nodes: selectedNodes,
        truncated: hasMore,
      };
    }),
} satisfies TRPCRouterRecord;
