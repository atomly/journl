import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { env } from "~/env";
import { api } from "~/trpc/server";

export const semanticJournalSearch = createTool({
  description:
    "Search the journal for entries that are semantically similar to a query",
  execute: async ({ context }) => {
    const results = await api.journal.getRelevantEntries({
      limit: context.limit,
      query: context.query,
      threshold: context.threshold,
    });

    return results.map((result) => ({
      content: result.embedding.chunk_markdown_text,
      date: result.journal_entry.date,
      link: `${env.PUBLIC_WEB_URL}/journal/${result.journal_entry.date}`,
      similarity: result.similarity,
    }));
  },
  id: "semantic-journal-search",
  inputSchema: z.object({
    limit: z.number().describe("The number of results to return").default(5),
    query: z.string().describe("The query to search the journal for"),
    threshold: z
      .number()
      .describe("The similarity threshold to return results")
      .default(0.1),
  }),
  outputSchema: z.array(
    z.object({
      content: z.string(),
      date: z.string(),
      link: z.string(),
      similarity: z.number(),
    }),
  ),
});
