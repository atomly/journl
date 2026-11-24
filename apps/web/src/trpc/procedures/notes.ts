import { and, cosineDistance, desc, eq, gt, ilike, or, sql } from "@acme/db";
import {
  BlockSearchText,
  DocumentEmbedding,
  JournalEntry,
  Page,
} from "@acme/db/schema";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { embed } from "ai";
import { z } from "zod/v4";
import { model } from "~/ai/providers/openai/embedding";
import { protectedProcedure, type TRPCContext, usageGuard } from "../trpc";

type Note =
  | {
      type: "page";
      id: string;
      content: string;
      created_at: string;
      header: string;
      similarity: number;
      updated_at: string;
    }
  | {
      type: "journal";
      id: string;
      date: string;
      content: string;
      created_at: string;
      similarity: number;
      updated_at: string;
    };

type SimilarNotesInput = {
  limit: number;
  offset: number;
  query: string;
  threshold: number;
};

/** Text fallback for the similarity search when the embedding provider is
 * unavailable. Matches the query terms against the stored block search text
 * and keeps the similarity result shape, limit and offset contract. */
async function textSimilarNotes(
  db: TRPCContext["db"],
  userId: string,
  input: SimilarNotesInput,
): Promise<Note[]> {
  const terms = [
    ...new Set(
      input.query
        .toLowerCase()
        .split(/\s+/)
        .filter((term) => term.length > 0),
    ),
  ];
  if (terms.length === 0) return [];
  // One most recently updated matching block per document, mirroring the
  // per-document chunk of the embedding similarity query.
  const matches = await db
    .selectDistinctOn([BlockSearchText.document_id], {
      journal_entry: JournalEntry,
      page: Page,
      search: BlockSearchText,
    })
    .from(BlockSearchText)
    .where(
      and(
        eq(BlockSearchText.user_id, userId),
        or(
          ...terms.map((term) =>
            ilike(
              BlockSearchText.search_text,
              `%${term.replace(/[\\%_]/g, "\\$&")}%`,
            ),
          ),
        ),
      ),
    )
    .leftJoin(Page, eq(BlockSearchText.document_id, Page.document_id))
    .leftJoin(
      JournalEntry,
      eq(BlockSearchText.document_id, JournalEntry.document_id),
    )
    .orderBy(BlockSearchText.document_id, desc(BlockSearchText.updated_at));

  const results = matches
    // Only include results that have a raw text length greater than 1.
    .filter((result) => result.search.search_text.length > 1)
    .sort((a, b) => {
      return (
        b.search.updated_at.localeCompare(a.search.updated_at) ||
        b.search.document_id.localeCompare(a.search.document_id)
      );
    })
    .slice(input.offset, input.offset + input.limit);

  const notes: Note[] = [];

  for (const result of results) {
    if (result.page) {
      notes.push({
        content: result.search.search_text,
        created_at: result.page.created_at,
        header: result.page.title,
        id: result.page.id,
        // Text matches carry no embedding similarity signal.
        similarity: 0,
        type: "page",
        updated_at: result.search.updated_at,
      });
    }

    if (result.journal_entry) {
      notes.push({
        content: result.search.search_text,
        created_at: result.journal_entry.created_at,
        date: result.journal_entry.date,
        id: result.journal_entry.id,
        similarity: 0,
        type: "journal",
        updated_at: result.search.updated_at,
      });
    }
  }

  return notes;
}

export const notesRouter = {
  getSimilarNotes: protectedProcedure
    .use(usageGuard)
    .input(
      z.object({
        limit: z.number().min(1).max(20).default(5),
        offset: z.number().min(0).default(0),
        query: z.string().max(10000),
        threshold: z.number().min(0).max(1).default(0.3),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Only the embedding call is guarded: a failing provider must degrade to
      // the text search instead of failing the whole request. Database errors
      // keep their original error handling below.
      let embedding: number[];
      try {
        embedding = (await embed({ model, value: input.query })).embedding;
      } catch (error) {
        console.error(
          "Embedding failed in notes.getSimilarNotes, serving text search fallback:",
          error,
        );
        try {
          return await textSimilarNotes(ctx.db, ctx.session.user.id, input);
        } catch (fallbackError) {
          console.error(
            "Text search fallback failed in notes.getSimilarNotes:",
            fallbackError,
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch similar journal entries",
          });
        }
      }

      try {
        const embeddingSimilarity = sql<number>`1 - (${cosineDistance(DocumentEmbedding.vector, embedding)})`;

        const matches = await ctx.db
          .selectDistinctOn([DocumentEmbedding.document_id], {
            embedding: DocumentEmbedding,
            journal_entry: JournalEntry,
            page: Page,
            similarity: embeddingSimilarity,
          })
          .from(DocumentEmbedding)
          .where(
            and(
              eq(DocumentEmbedding.user_id, ctx.session.user.id),
              gt(embeddingSimilarity, input.threshold),
            ),
          )
          .leftJoin(Page, eq(DocumentEmbedding.document_id, Page.document_id))
          .leftJoin(
            JournalEntry,
            eq(DocumentEmbedding.document_id, JournalEntry.document_id),
          )
          .orderBy(DocumentEmbedding.document_id, desc(embeddingSimilarity));

        const results = matches
          // Only include results that have a raw text length greater than 1.
          .filter((result) => result.embedding.chunk_raw_text.length > 1)
          .sort((a, b) => {
            return b.similarity - a.similarity;
          });

        const notes: Note[] = [];

        for (const result of results) {
          if (result.page) {
            notes.push({
              content: result.embedding.chunk_raw_text,
              created_at: result.page.created_at,
              header: result.page.title,
              id: result.page.id,
              similarity: result.similarity,
              type: "page",
              updated_at: result.embedding.updated_at,
            });
          }

          if (result.journal_entry) {
            notes.push({
              content: result.embedding.chunk_raw_text,
              created_at: result.journal_entry.created_at,
              date: result.journal_entry.date,
              id: result.journal_entry.id,
              similarity: result.similarity,
              type: "journal",
              updated_at: result.embedding.updated_at,
            });
          }
        }

        return notes;
      } catch (error) {
        console.error("Database error in journal.getRelevantEntries:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch similar journal entries",
        });
      }
    }),
} satisfies TRPCRouterRecord;
