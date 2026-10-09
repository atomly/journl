import { blocknoteBlocks } from "@acme/blocknote/server";
import { and, eq } from "@acme/db";
import { BlockEdge, BlockNode, JournalEntry, Page } from "@acme/db/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { env } from "~/env";
import {
  classifyInternalUrl,
  getTargetKey,
  normalizeExternalUrl,
  type ReferenceTarget,
} from "~/references/reference-utils";
import { protectedProcedure } from "../trpc";

import {
  zTarget,
  collectBlock,
  externalPreview,
  resolveInternal,
} from "./reference-api-helpers";

export const referenceEmbedProcedures = {
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
} satisfies TRPCRouterRecord;
