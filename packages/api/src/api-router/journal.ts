import { blocknoteBlocks } from "@acme/blocknote/server";
import { and, between, cosineDistance, desc, eq, gt, sql } from "@acme/db";
import {
  Document,
  DocumentEmbedding,
  JournalEntry,
  zJournalEntryDate,
} from "@acme/db/schema";
import { openai } from "@ai-sdk/openai";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { embed } from "ai";
import { z } from "zod/v4";
import {
  saveTransactions,
  zBlockTransactions,
} from "../shared/block-transaction.js";
import { protectedProcedure } from "../trpc.js";

export const journalRouter = {
  getBetween: protectedProcedure
    .input(
      z.object({
        from: z
          .string()
          .describe("The start date of the search in ISO 8601 format"),
        to: z
          .string()
          .describe("The end date of the search in ISO 8601 format"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const entries = await ctx.db.query.JournalEntry.findMany({
        where: and(
          eq(JournalEntry.user_id, ctx.session.user.id),
          between(JournalEntry.date, input.from, input.to),
        ),
        with: {
          block_edges: true,
          block_nodes: true,
        },
      });

      return entries.map(({ block_nodes, block_edges, ...entry }) => ({
        ...entry,
        blocks: blocknoteBlocks(block_nodes, block_edges),
      }));
    }),
  getByDate: protectedProcedure
    .input(
      z.object({
        date: zJournalEntryDate,
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const result = await ctx.db.query.JournalEntry.findFirst({
          where: and(
            eq(JournalEntry.date, input.date),
            eq(JournalEntry.user_id, ctx.session.user.id),
          ),
          with: {
            block_edges: true,
            block_nodes: true,
          },
        });

        if (!result) {
          return {
            date: input.date,
          };
        }

        const { block_nodes, block_edges, ...entry } = result;

        return {
          ...entry,
          blocks: blocknoteBlocks(block_nodes, block_edges),
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("Database error in journal.byId:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch journal entry",
        });
      }
    }),
  getRelevantEntries: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(20).default(5),
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
            journal_entry: JournalEntry,
            similarity: embeddingSimilarity,
          })
          .from(DocumentEmbedding)
          .where(
            and(
              eq(DocumentEmbedding.user_id, ctx.session.user.id),
              gt(embeddingSimilarity, input.threshold),
            ),
          )
          .innerJoin(
            JournalEntry,
            eq(DocumentEmbedding.document_id, JournalEntry.document_id),
          )
          .orderBy(DocumentEmbedding.document_id, desc(embeddingSimilarity));

        results.sort((a, b) => {
          return b.similarity - a.similarity;
        });

        return results;
      } catch (error) {
        console.error("Database error in journal.getRelevantEntries:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch similar journal entries",
        });
      }
    }),
  getTimeline: protectedProcedure
    .input(
      z.object({
        cursor: z
          .number()
          .default(0)
          .describe("The cursor to start the search from, 0 is today"),
        limit: z
          .number()
          .min(1)
          .max(30)
          .default(7)
          .describe("The number of days to search for, 7 is a week"),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Given a limit of 7 days, 1 page will be equivalent to 7 days going backward from today
        const from = new Date(input.cursor);
        const to = new Date(from);
        to.setDate(to.getDate() - (input.limit - 1)); // Subtract (limit - 1) to get exactly 'limit' days
        to.setHours(0, 0, 0, 0); // Start of day

        const results = await ctx.db.query.JournalEntry.findMany({
          orderBy: JournalEntry.date,
          where: and(
            eq(JournalEntry.user_id, ctx.session.user.id),
            between(JournalEntry.date, to.toISOString(), from.toISOString()),
          ),
          with: {
            block_edges: true,
            block_nodes: true,
          },
        });

        const entriesByDate = new Map(
          results.map(({ block_nodes, block_edges, ...entry }) => {
            const dateKey = new Date(entry.date).toISOString().split("T")[0];
            return [
              dateKey,
              {
                ...entry,
                blocks: blocknoteBlocks(block_nodes, block_edges),
              },
            ];
          }),
        );

        // Generate all dates in the range and fill missing days with placeholders
        // Start from the newest date and work backwards for descending order
        const timeline: (
          | { date: string }
          | Exclude<ReturnType<typeof entriesByDate.get>, undefined>
        )[] = [];
        const currentDate = new Date(from);
        const endDate = new Date(to);

        while (currentDate >= endDate) {
          const dateKey = currentDate.toISOString().split("T")[0];

          if (!dateKey) continue;

          const entry = entriesByDate.get(dateKey);

          if (entry) {
            // Use actual entry
            timeline.push(entry);
          } else {
            // Create placeholder entry
            timeline.push({
              date: dateKey,
            });
          }

          // Move to previous day
          currentDate.setDate(currentDate.getDate() - 1);
        }

        // Calculate next page cursor: continue from where this page ends
        // If current page is July 8th to July 2nd, next page should start July 1st
        const nextPageDate = new Date(from);
        nextPageDate.setDate(nextPageDate.getDate() - input.limit);

        return {
          nextPage: nextPageDate.getTime(),
          timeline,
        };
      } catch (error) {
        console.error("Database error in journal.byPage:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch journal entries",
        });
      }
    }),
  saveTransactions: protectedProcedure
    .input(
      zBlockTransactions.extend({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        document_id: z.uuid().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.db.transaction(async (tx) => {
          let documentId = input.document_id;
          let journalEntry: JournalEntry | null = null;

          if (!documentId) {
            const [document] = await tx
              .insert(Document)
              .values({
                user_id: ctx.session.user.id,
              })
              .returning();

            if (!document) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to create document",
              });
            }

            documentId = document.id;

            const [entry] = await tx
              .insert(JournalEntry)
              .values({
                date: input.date,
                document_id: document.id,
                user_id: ctx.session.user.id,
              })
              .returning();

            if (!entry) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to create journal entry",
              });
            }

            journalEntry = entry;
          }

          await saveTransactions(
            { ...ctx, db: tx },
            {
              ...input,
              document_id: documentId,
            },
          );

          return journalEntry ?? null;
        });
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("Database error in journal.write:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update journal entry",
        });
      }
    }),
} satisfies TRPCRouterRecord;
