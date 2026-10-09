import { and, asc, desc, eq, gt, ilike, inArray, lt, or } from "@acme/db";
import { BlockSearchText, JournalEntry, Page } from "@acme/db/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { env } from "~/env";
import { protectedProcedure } from "../trpc";

import { truncate } from "./reference-api-helpers";

export const referenceSearchProcedures = {
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
