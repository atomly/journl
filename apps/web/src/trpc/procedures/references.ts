import { createHash } from "node:crypto";
import { blocknoteBlocks } from "@acme/blocknote/server";
import { and, asc, desc, eq, gt, ilike, inArray, lt, or, sql } from "@acme/db";
import {
  BlockEdge,
  BlockNode,
  BlockSearchText,
  Document,
  DocumentReference,
  JournalEntry,
  Page,
} from "@acme/db/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { env } from "~/env";
import { getGithubMetadata } from "~/references/github-provider";
import {
  getExternalGraphTitle,
  getGraphDocumentTargetKey,
} from "~/references/graph-utils";
import {
  classifyInternalUrl,
  getTargetKey,
  normalizeExternalUrl,
  type ReferenceTarget,
} from "~/references/reference-utils";
import { getWebsiteMetadata } from "~/references/website-provider";
import { protectedProcedure, type TRPCContext } from "../trpc";

const zTarget = z.discriminatedUnion("kind", [
  z.object({
    blockId: z.uuid().optional(),
    documentId: z.uuid(),
    kind: z.literal("document"),
  }),
  z.object({ kind: z.literal("external"), url: z.string().url().max(2048) }),
]);

function truncate(text: string, max: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > max
    ? { text: `${normalized.slice(0, max - 1).trimEnd()}…`, truncated: true }
    : { text: normalized, truncated: false };
}

function blockText(value: unknown, inCode = false): string {
  if (Array.isArray(value))
    return value.map((item) => blockText(item, inCode)).join(" ");
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  const code = inCode || record.type === "codeBlock";
  if (code) return "";
  if (record.type === "text" && typeof record.text === "string")
    return record.text;
  if (
    record.type === "contentReference" ||
    record.type === "referenceCard" ||
    record.type === "contentEmbed"
  ) {
    const props = record.props as { label?: unknown } | undefined;
    return typeof props?.label === "string" ? props.label : "";
  }
  return ["content", "rows", "cells", "children"]
    .map((key) => blockText(record[key], code))
    .filter(Boolean)
    .join(" ");
}

function collectBlock(
  blocks: ReturnType<typeof blocknoteBlocks>,
  blockId?: string,
) {
  if (!blocks) return [];
  type TreeBlock = (typeof blocks)[number];
  const flattened: Array<TreeBlock & { depth: number }> = [];
  const visit = (block: TreeBlock, depth = 0): void => {
    flattened.push({ ...block, depth });
    for (const child of block.children ?? []) visit(child, depth + 1);
  };
  for (const block of blocks) visit(block);
  if (!blockId) return flattened;
  const targetIndex = flattened.findIndex((block) => block.id === blockId);
  if (targetIndex < 0) return [];
  const find = (items: readonly TreeBlock[]): TreeBlock | undefined => {
    for (const item of items) {
      if (item.id === blockId) return item;
      const child = find(item.children ?? []);
      if (child) return child;
    }
    return undefined;
  };
  const target = find(blocks);
  const subtree: Array<TreeBlock & { depth: number }> = [];
  if (target) {
    const visitSubtree = (block: TreeBlock, depth = 0): void => {
      subtree.push({ ...block, depth });
      for (const child of block.children ?? []) visitSubtree(child, depth + 1);
    };
    visitSubtree(target);
  }
  return subtree;
}

function blockSnippet(
  blocks: ReturnType<typeof blocknoteBlocks>,
  blockId?: string,
) {
  const selected = collectBlock(blocks, blockId);
  return selected
    .map((block) => blockText(block))
    .filter(Boolean)
    .join(" ");
}

async function externalPreview(url: string, userId: string) {
  const parsed = new URL(url);
  const isGithub = parsed.hostname.toLowerCase() === "github.com";
  const segments = parsed.pathname.split("/").filter(Boolean);
  const [githubMetadata, websiteMetadata] = await Promise.all([
    isGithub ? getGithubMetadata(userId, url) : Promise.resolve(null),
    getWebsiteMetadata(userId, url),
  ]);
  let title = parsed.hostname;
  let excerpt = parsed.href;
  if (isGithub && segments.length >= 2) {
    title = `${segments[0]}/${segments[1]}`;
    if (
      segments.length >= 4 &&
      ["issues", "pull"].includes(segments[2] ?? "")
    ) {
      title += ` #${segments[3]}`;
    }
    excerpt = `GitHub · ${title}`;
  }
  if (websiteMetadata) {
    title = websiteMetadata.title || title;
    excerpt = websiteMetadata.excerpt || excerpt;
  }
  if (githubMetadata) {
    title = githubMetadata.title;
    excerpt = githubMetadata.excerpt || excerpt;
  }
  return {
    excerpt,
    href: url,
    kind: "external" as const,
    metadataState:
      githubMetadata || websiteMetadata
        ? ("enriched" as const)
        : ("url-only" as const),
    provider: isGithub ? ("github" as const) : ("generic" as const),
    status: "ready" as const,
    title,
    truncated: false,
    ...(githubMetadata?.status ? { sourceStatus: githubMetadata.status } : {}),
    ...(websiteMetadata?.imageUrl
      ? { imageUrl: websiteMetadata.imageUrl }
      : {}),
  };
}

async function resolveInternal(
  db: TRPCContext["db"],
  userId: string,
  target: Extract<ReferenceTarget, { kind: "document" }>,
) {
  const [document] = await db
    .select()
    .from(Document)
    .where(
      and(eq(Document.id, target.documentId), eq(Document.user_id, userId)),
    )
    .limit(1);
  if (!document) return { status: "unavailable" as const };

  const [page] = await db
    .select()
    .from(Page)
    .where(and(eq(Page.document_id, document.id), eq(Page.user_id, userId)))
    .limit(1);
  const [entry] = await db
    .select()
    .from(JournalEntry)
    .where(
      and(
        eq(JournalEntry.document_id, document.id),
        eq(JournalEntry.user_id, userId),
      ),
    )
    .limit(1);
  if ((!page && !entry) || (page && entry))
    return { status: "unavailable" as const };

  const blocks = await db
    .select()
    .from(BlockNode)
    .where(
      and(
        eq(BlockNode.user_id, userId),
        eq(BlockNode.document_id, document.id),
      ),
    );
  if (target.blockId && !blocks.some((block) => block.id === target.blockId)) {
    return { status: "unavailable" as const };
  }
  const edges = await db
    .select()
    .from(BlockEdge)
    .where(
      and(
        eq(BlockEdge.user_id, userId),
        eq(BlockEdge.document_id, document.id),
      ),
    );
  const tree = blocknoteBlocks(blocks, edges);
  const content = blockSnippet(tree, target.blockId);
  const excerpt = truncate(content, 240);
  const title = page?.title ?? entry?.date ?? "Journal entry";
  const kind = page ? ("page" as const) : ("journal" as const);
  const entityId = page?.id ?? entry?.id;
  const href = page
    ? `${env.PUBLIC_WEB_URL}/pages/${page.id}`
    : `${env.PUBLIC_WEB_URL}/journal/${entry?.date}`;
  return {
    contentUpdatedAt: document.updated_at,
    documentId: document.id,
    entityId,
    excerpt: excerpt.text || "No description yet.",
    href: target.blockId ? `${href}#block=${target.blockId}` : href,
    kind,
    metadataUpdatedAt: page?.updated_at ?? entry?.updated_at,
    status: "ready" as const,
    targetBlockId: target.blockId,
    title,
    truncated: excerpt.truncated,
  };
}

export const referencesRouter = {
  getEmbedContent: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        targets: z
          .array(
            z.object({ blockId: z.uuid().optional(), documentId: z.uuid() }),
          )
          .min(1)
          .max(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const targets = input.targets.map((target) => ({
        kind: "document" as const,
        ...target,
      }));
      const signature = targets.map((target) => getTargetKey(target)).join("|");
      let cursorData: {
        signature?: string;
        offsets?: Record<string, { offset: number; version: string }>;
      } = {};
      if (input.cursor) {
        try {
          cursorData = JSON.parse(
            Buffer.from(input.cursor, "base64url").toString("utf8"),
          ) as typeof cursorData;
          if (cursorData.signature !== signature)
            throw new Error("Cursor scope mismatch");
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid cursor",
          });
        }
      }
      const results: unknown[] = [];
      const offsets: Record<string, { offset: number; version: string }> = {};
      let totalBlocks = 0;
      let totalBytes = 0;
      let truncated = false;
      for (const target of targets) {
        const key = getTargetKey(target);
        if (!key) continue;
        const preview = await resolveInternal(
          ctx.db,
          ctx.session.user.id,
          target,
        );
        if (preview.status !== "ready") {
          results.push({ status: "unavailable", target });
          continue;
        }
        const [blocks, edges] = await Promise.all([
          ctx.db
            .select()
            .from(BlockNode)
            .where(
              and(
                eq(BlockNode.user_id, ctx.session.user.id),
                eq(BlockNode.document_id, target.documentId),
              ),
            ),
          ctx.db
            .select()
            .from(BlockEdge)
            .where(
              and(
                eq(BlockEdge.user_id, ctx.session.user.id),
                eq(BlockEdge.document_id, target.documentId),
              ),
            ),
        ]);
        const tree = blocknoteBlocks(blocks, edges);
        const content = collectBlock(tree, target.blockId);
        const savedOffset = cursorData.offsets?.[key];
        const offset =
          savedOffset?.version === preview.contentUpdatedAt
            ? savedOffset.offset
            : 0;
        const selected = content.slice(offset);
        const pageBlocks: unknown[] = [];
        for (const block of selected) {
          if (pageBlocks.length >= 200 || totalBlocks >= 500) {
            truncated = true;
            break;
          }
          const normalized = {
            content: block.content,
            depth: block.depth,
            id: block.id,
            props: block.props,
            type: block.type,
          };
          const bytes = Buffer.byteLength(JSON.stringify(normalized), "utf8");
          if (totalBytes + bytes > 256 * 1024) {
            truncated = true;
            break;
          }
          pageBlocks.push(normalized);
          totalBytes += bytes;
          totalBlocks += 1;
        }
        const nextOffset = offset + pageBlocks.length;
        if (nextOffset < content.length) {
          truncated = true;
          offsets[key] = {
            offset: nextOffset,
            version: preview.contentUpdatedAt,
          };
        }
        results.push({
          blocks: pageBlocks,
          contentUpdatedAt: preview.contentUpdatedAt,
          href: preview.href,
          status: "ready",
          target,
          title: preview.title,
          truncated: nextOffset < content.length,
        });
      }
      return {
        items: results,
        nextCursor:
          Object.keys(offsets).length > 0
            ? Buffer.from(JSON.stringify({ offsets, signature })).toString(
                "base64url",
              )
            : null,
        truncated,
      };
    }),
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
      type GraphNode = {
        key: string;
        target?: ReferenceTarget;
        title: string;
        href?: string;
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
        });
      }
      const edgeMap = new Map<
        string,
        {
          fromKey: string;
          toKey: string;
          occurrenceCount: number;
          presentations: Set<string>;
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
            const [block] = await ctx.db
              .select()
              .from(BlockNode)
              .where(
                and(
                  eq(BlockNode.id, occurrence.target_block_id),
                  eq(BlockNode.document_id, occurrence.target_document_id),
                  eq(BlockNode.user_id, ctx.session.user.id),
                ),
              )
              .limit(1);
            if (block && note)
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
          presentations: new Set<string>(),
          sourceBlocks: [],
          toKey,
        };
        edge.occurrenceCount += 1;
        edge.presentations.add(occurrence.presentation);
        if (
          edge.sourceBlocks.length < 3 &&
          !edge.sourceBlocks.includes(occurrence.source_block_id)
        )
          edge.sourceBlocks.push(occurrence.source_block_id);
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
  getPreviews: protectedProcedure
    .input(z.object({ targets: z.array(zTarget).max(50) }))
    .query(async ({ ctx, input }) => {
      return {
        items: await Promise.all(
          input.targets.map(async (target) => ({
            preview:
              target.kind === "external"
                ? await externalPreview(target.url, ctx.session.user.id)
                : await resolveInternal(ctx.db, ctx.session.user.id, target),
            target,
          })),
        ),
      };
    }),
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
  resolveUrls: protectedProcedure
    .input(z.object({ urls: z.array(z.string().max(2048)).max(50) }))
    .query(async ({ ctx, input }) => {
      const uniqueUrls = [...new Set(input.urls)];
      if (uniqueUrls.length > 50) throw new TRPCError({ code: "BAD_REQUEST" });
      const items = await Promise.all(
        uniqueUrls.map(async (url) => {
          const route = classifyInternalUrl(url, [], env.PUBLIC_WEB_URL);
          let target: ReferenceTarget | null = null;
          if (route?.kind === "page") {
            const [page] = await ctx.db
              .select({ documentId: Page.document_id })
              .from(Page)
              .where(
                and(
                  eq(Page.id, route.entityId),
                  eq(Page.user_id, ctx.session.user.id),
                ),
              )
              .limit(1);
            if (page)
              target = {
                documentId: page.documentId,
                kind: "document",
                ...(route.blockId ? { blockId: route.blockId } : {}),
              };
          } else if (route?.kind === "journal") {
            const [entry] = await ctx.db
              .select({ documentId: JournalEntry.document_id })
              .from(JournalEntry)
              .where(
                and(
                  eq(JournalEntry.date, route.date),
                  eq(JournalEntry.user_id, ctx.session.user.id),
                ),
              )
              .limit(1);
            if (entry)
              target = {
                documentId: entry.documentId,
                kind: "document",
                ...(route.blockId ? { blockId: route.blockId } : {}),
              };
          }
          if (target)
            return {
              preview: await resolveInternal(
                ctx.db,
                ctx.session.user.id,
                target,
              ),
              target,
              url,
            };
          if (!route && /^https?:\/\//i.test(url)) {
            try {
              const external = new URL(url);
              if (!external.username && !external.password) {
                const normalized = normalizeExternalUrl(external.toString());
                if (normalized) {
                  return {
                    preview: await externalPreview(
                      normalized,
                      ctx.session.user.id,
                    ),
                    target: { kind: "external" as const, url: normalized },
                    url,
                  };
                }
              }
            } catch {
              // Invalid URLs use the unavailable fallback.
            }
          }
          return {
            preview: { status: "unavailable" as const },
            target: null,
            url,
          };
        }),
      );
      return { items };
    }),
  searchBlocks: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
        query: z.string().min(1).max(200),
      }),
    )
    .query(async ({ ctx, input }) => {
      let after: { documentId: string; blockId: string } | undefined;
      if (input.cursor) {
        try {
          const decoded = JSON.parse(
            Buffer.from(input.cursor, "base64url").toString("utf8"),
          ) as { documentId?: unknown; blockId?: unknown };
          if (
            typeof decoded.documentId !== "string" ||
            typeof decoded.blockId !== "string"
          ) {
            throw new Error("Invalid cursor");
          }
          after = { blockId: decoded.blockId, documentId: decoded.documentId };
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid cursor",
          });
        }
      }
      const pattern = `%${input.query.replace(/[\\%_]/g, "\\$&")}%`;
      const matches = await ctx.db
        .select({
          blockId: BlockSearchText.block_id,
          documentId: BlockSearchText.document_id,
          snippet: BlockSearchText.search_text,
        })
        .from(BlockSearchText)
        .where(
          and(
            eq(BlockSearchText.user_id, ctx.session.user.id),
            ilike(BlockSearchText.search_text, pattern),
            after
              ? or(
                  gt(BlockSearchText.document_id, after.documentId),
                  and(
                    eq(BlockSearchText.document_id, after.documentId),
                    gt(BlockSearchText.block_id, after.blockId),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(BlockSearchText.document_id, BlockSearchText.block_id)
        .limit(input.limit + 1);
      const page = matches.slice(0, input.limit);
      const documentIds = [...new Set(page.map((match) => match.documentId))];
      const [pages, entries] = await Promise.all([
        documentIds.length
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
                  inArray(Page.document_id, documentIds),
                ),
              )
          : Promise.resolve([]),
        documentIds.length
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
                  inArray(JournalEntry.document_id, documentIds),
                ),
              )
          : Promise.resolve([]),
      ]);
      const noteByDocument = new Map<
        string,
        {
          documentId: string;
          entityId: string;
          kind: "page" | "journal";
          title: string;
        }
      >();
      for (const page of pages) {
        noteByDocument.set(page.documentId, { ...page, kind: "page" });
      }
      for (const entry of entries) {
        noteByDocument.set(entry.documentId, { ...entry, kind: "journal" });
      }
      const items = page.flatMap((match) => {
        const note = noteByDocument.get(match.documentId);
        if (!note) return [];
        const snippet = truncate(match.snippet, 160).text;
        const href =
          note.kind === "page"
            ? `${env.PUBLIC_WEB_URL}/pages/${note.entityId}#block=${match.blockId}`
            : `${env.PUBLIC_WEB_URL}/journal/${note.title}#block=${match.blockId}`;
        return [
          {
            blockId: match.blockId,
            documentId: match.documentId,
            documentTitle: note.title,
            href,
            kind: note.kind,
            snippet,
          },
        ];
      });
      const last = page.at(-1);
      return {
        items,
        nextCursor:
          matches.length > input.limit && last
            ? Buffer.from(
                JSON.stringify({
                  blockId: last.blockId,
                  documentId: last.documentId,
                }),
              ).toString("base64url")
            : null,
      };
    }),
  searchTargets: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
        query: z.string().max(200),
      }),
    )
    .query(async ({ ctx, input }) => {
      const cursorScope = JSON.stringify({
        limit: input.limit,
        query: input.query,
        userId: ctx.session.user.id,
      });
      type SearchAfter = { documentId: string; updatedAt: string };
      let pageAfter: SearchAfter | undefined;
      let journalAfter: SearchAfter | undefined;
      if (input.cursor) {
        try {
          const cursor = JSON.parse(
            Buffer.from(input.cursor, "base64url").toString("utf8"),
          ) as {
            journalAfter?: unknown;
            pageAfter?: unknown;
            scope?: unknown;
          };
          const parseAfter = (value: unknown): SearchAfter | undefined => {
            if (value === undefined) return undefined;
            if (!value || typeof value !== "object") throw new Error();
            const record = value as Record<string, unknown>;
            if (
              typeof record.documentId !== "string" ||
              !z.uuid().safeParse(record.documentId).success ||
              typeof record.updatedAt !== "string" ||
              Number.isNaN(Date.parse(record.updatedAt))
            )
              throw new Error();
            return {
              documentId: record.documentId,
              updatedAt: record.updatedAt,
            };
          };
          if (cursor.scope !== cursorScope) throw new Error();
          pageAfter = parseAfter(cursor.pageAfter);
          journalAfter = parseAfter(cursor.journalAfter);
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid cursor",
          });
        }
      }
      const pattern = input.query
        ? `%${input.query.replace(/[\\%_]/g, "\\$&")}%`
        : "%";
      const pages = await ctx.db
        .select({
          documentId: Page.document_id,
          entityId: Page.id,
          kind: Page.title,
          title: Page.title,
          updatedAt: Page.updated_at,
        })
        .from(Page)
        .where(
          and(
            eq(Page.user_id, ctx.session.user.id),
            ilike(Page.title, pattern),
            pageAfter
              ? or(
                  lt(Page.updated_at, pageAfter.updatedAt),
                  and(
                    eq(Page.updated_at, pageAfter.updatedAt),
                    gt(Page.document_id, pageAfter.documentId),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(desc(Page.updated_at), asc(Page.document_id))
        .limit(input.limit + 1);
      const entries = await ctx.db
        .select({
          date: JournalEntry.date,
          documentId: JournalEntry.document_id,
          entityId: JournalEntry.id,
          updatedAt: JournalEntry.updated_at,
        })
        .from(JournalEntry)
        .where(
          and(
            eq(JournalEntry.user_id, ctx.session.user.id),
            ilike(JournalEntry.date, pattern),
            journalAfter
              ? or(
                  lt(JournalEntry.updated_at, journalAfter.updatedAt),
                  and(
                    eq(JournalEntry.updated_at, journalAfter.updatedAt),
                    gt(JournalEntry.document_id, journalAfter.documentId),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(desc(JournalEntry.updated_at), asc(JournalEntry.document_id))
        .limit(input.limit + 1);
      const items = [
        ...pages.map((page) => ({
          documentId: page.documentId,
          entityId: page.entityId,
          href: `${env.PUBLIC_WEB_URL}/pages/${page.entityId}`,
          kind: "page" as const,
          title: page.title,
          updatedAt: page.updatedAt,
        })),
        ...entries.map((entry) => ({
          documentId: entry.documentId,
          entityId: entry.entityId,
          href: `${env.PUBLIC_WEB_URL}/journal/${entry.date}`,
          kind: "journal" as const,
          title: entry.date,
          updatedAt: entry.updatedAt,
        })),
      ].sort(
        (a, b) =>
          b.updatedAt.localeCompare(a.updatedAt) ||
          a.documentId.localeCompare(b.documentId) ||
          a.kind.localeCompare(b.kind),
      );
      const available = items.slice(0, input.limit + 1);
      const page = available.slice(0, input.limit);
      let nextPageAfter = pageAfter;
      let nextJournalAfter = journalAfter;
      for (const item of page) {
        const position = {
          documentId: item.documentId,
          updatedAt: item.updatedAt,
        };
        if (item.kind === "page") nextPageAfter = position;
        else nextJournalAfter = position;
      }
      const nextCursor =
        available.length > input.limit
          ? Buffer.from(
              JSON.stringify({
                journalAfter: nextJournalAfter,
                pageAfter: nextPageAfter,
                scope: cursorScope,
              }),
            ).toString("base64url")
          : null;
      return { items: page, nextCursor };
    }),
} satisfies TRPCRouterRecord;
