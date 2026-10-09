import { blocknoteBlocks } from "@acme/blocknote/server";
import { and, eq } from "@acme/db";
import {
  BlockEdge,
  BlockNode,
  Document,
  DocumentReference,
  JournalEntry,
  Page,
} from "@acme/db/schema";
import { z } from "zod/v4";
import { env } from "~/env";
import { getGithubMetadata } from "~/references/github-provider";
import { type ReferenceTarget } from "~/references/reference-utils";
import { getWebsiteMetadata } from "~/references/website-provider";
import { type TRPCContext } from "../trpc";

export const zTarget = z.discriminatedUnion("kind", [
  z.object({
    blockId: z.uuid().optional(),
    documentId: z.uuid(),
    kind: z.literal("document"),
  }),
  z.object({ kind: z.literal("external"), url: z.string().url().max(2048) }),
]);

export function truncate(text: string, max: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > max
    ? { text: `${normalized.slice(0, max - 1).trimEnd()}…`, truncated: true }
    : { text: normalized, truncated: false };
}

export function blockText(value: unknown, inCode = false): string {
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

export type GraphOccurrenceRow = Pick<
  typeof DocumentReference.$inferSelect,
  "id" | "presentation" | "source_block_id" | "source_document_id"
>;
export type GraphSourceBlock = Pick<
  typeof BlockNode.$inferSelect,
  "data" | "document_id" | "user_id"
>;
export type GraphSourceNote = { href: string };

export type GraphSourceExcerpt = {
  blockId: string;
  excerpt: string;
  href: string;
};

export function createGraphSourceExcerpt(
  occurrence: GraphOccurrenceRow,
  block: GraphSourceBlock | undefined,
  note: GraphSourceNote | undefined,
  userId: string,
): GraphSourceExcerpt | undefined {
  if (
    !block ||
    !note ||
    block.user_id !== userId ||
    block.document_id !== occurrence.source_document_id
  )
    return undefined;
  return {
    blockId: occurrence.source_block_id,
    excerpt: truncate(blockText(block.data), 160).text,
    href: `${note.href}#block=${occurrence.source_block_id}`,
  };
}

export type GraphEdgeAccumulator = {
  occurrenceCount: number;
  occurrenceIds: string[];
  presentations: Set<string>;
  sources: GraphSourceExcerpt[];
  sourceBlocks: string[];
};

export function addGraphOccurrence(
  edge: GraphEdgeAccumulator,
  occurrence: GraphOccurrenceRow,
  excerpt?: GraphSourceExcerpt,
) {
  if (edge.occurrenceIds.includes(occurrence.id)) return;
  edge.occurrenceIds.push(occurrence.id);
  edge.occurrenceCount = edge.occurrenceIds.length;
  edge.presentations.add(occurrence.presentation);
  if (
    edge.sourceBlocks.length < 3 &&
    !edge.sourceBlocks.includes(occurrence.source_block_id)
  )
    edge.sourceBlocks.push(occurrence.source_block_id);
  if (
    excerpt &&
    edge.sources.length < 3 &&
    !edge.sources.some((item) => item.blockId === excerpt.blockId)
  )
    edge.sources.push(excerpt);
}

export function collectBlock(
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

export function blockSnippet(
  blocks: ReturnType<typeof blocknoteBlocks>,
  blockId?: string,
) {
  const selected = collectBlock(blocks, blockId);
  return selected
    .map((block) => blockText(block))
    .filter(Boolean)
    .join(" ");
}

export async function externalPreview(url: string, userId: string) {
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

export async function resolveInternal(
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
