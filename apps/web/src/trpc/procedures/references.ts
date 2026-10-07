import { blocknoteBlocks } from "@acme/blocknote/server";
import { and, desc, eq, ilike } from "@acme/db";
import {
  BlockEdge,
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
  classifyInternalUrl,
  type ReferenceTarget,
} from "~/references/reference-utils";
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
  const flattened: TreeBlock[] = [];
  const visit = (block: TreeBlock) => {
    flattened.push(block);
    block.children?.forEach(visit);
  };
  blocks.forEach(visit);
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
  const subtree: TreeBlock[] = [];
  if (target) {
    const visitSubtree = (block: TreeBlock) => {
      subtree.push(block);
      block.children?.forEach(visitSubtree);
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

function externalPreview(url: string) {
  const parsed = new URL(url);
  const isGithub = parsed.hostname.toLowerCase() === "github.com";
  const segments = parsed.pathname.split("/").filter(Boolean);
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
  return {
    excerpt,
    href: url,
    kind: "external" as const,
    metadataState: "url-only" as const,
    provider: isGithub ? ("github" as const) : ("generic" as const),
    status: "ready" as const,
    title,
    truncated: false,
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
  const kind = page ? "page" : "journal";
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
  getPreviews: protectedProcedure
    .input(z.object({ targets: z.array(zTarget).max(50) }))
    .query(async ({ ctx, input }) => ({
      items: await Promise.all(
        input.targets.map(async (target) => ({
          preview:
            target.kind === "external"
              ? externalPreview(target.url)
              : await resolveInternal(ctx.db, ctx.session.user.id, target),
          target,
        })),
      ),
    })),
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
      const items = await ctx.db
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
          ),
        )
        .limit(input.limit + 1);
      return {
        items: items.slice(0, input.limit),
        nextCursor:
          items.length > input.limit ? (items[input.limit]?.id ?? null) : null,
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
              target = { documentId: page.documentId, kind: "document" };
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
              target = { documentId: entry.documentId, kind: "document" };
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
                return {
                  preview: externalPreview(external.toString()),
                  target: {
                    kind: "external" as const,
                    url: external.toString(),
                  },
                  url,
                };
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
  searchTargets: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
        query: z.string().max(200),
      }),
    )
    .query(async ({ ctx, input }) => {
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
          ),
        )
        .orderBy(desc(Page.updated_at))
        .limit(500);
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
          ),
        )
        .orderBy(desc(JournalEntry.date))
        .limit(500);
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
          a.documentId.localeCompare(b.documentId),
      );
      const offset = input.cursor
        ? Number.parseInt(Buffer.from(input.cursor, "base64url").toString(), 10)
        : 0;
      const page = items.slice(offset, offset + input.limit);
      const nextCursor =
        offset + input.limit < items.length
          ? Buffer.from(String(offset + input.limit)).toString("base64url")
          : null;
      return { items: page, nextCursor };
    }),
} satisfies TRPCRouterRecord;
