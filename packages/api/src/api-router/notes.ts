import { and, cosineDistance, desc, eq, gt, sql } from "@acme/db";
import { DocumentEmbedding, Page } from "@acme/db/schema";
import { openai } from "@ai-sdk/openai";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { embed } from "ai";
import { z } from "zod/v4";
import { protectedProcedure } from "../trpc.js";

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
      header: string;
      similarity: number;
      updated_at: string;
    };

export const notesRouter = {
  getSimilarNotes: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(20).default(5),
        offset: z.number().min(0).default(0),
        query: z.string().max(10000),
        threshold: z.number().min(0).max(1).default(0.3),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const { embedding } = await embed({
          // ! TODO: Move this to a shared package called `@acme/ai`.
          model: openai.embedding("text-embedding-3-small"),
          value: input.query,
        });

        const embeddingSimilarity = sql<number>`1 - (${cosineDistance(DocumentEmbedding.vector, embedding)})`;

        const results = await ctx.db
          .selectDistinctOn([DocumentEmbedding.document_id], {
            embedding: DocumentEmbedding,
            // journal_entry: JournalEntry,
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
          // .leftJoin(
          //   JournalEntry,
          //   eq(DocumentEmbedding.document_id, JournalEntry.document_id),
          // )
          .orderBy(DocumentEmbedding.document_id, desc(embeddingSimilarity));

        results.sort((a, b) => {
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

          // if (result.journal_entry) {
          //   notes.push({
          //     content: result.embedding.chunk_raw_text,
          //     created_at: result.journal_entry.created_at,
          //     date: result.journal_entry.date,
          //     header: result.journal_entry.content,
          //     id: result.journal_entry.id,
          //     similarity: result.similarity,
          //     type: "journal",
          //     updated_at: result.embedding.updated_at,
          //   });
          // }
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
