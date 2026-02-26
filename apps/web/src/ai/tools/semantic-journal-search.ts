import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { env } from "~/env";
import { api } from "~/trpc/server";

export const semanticJournalSearch = createTool({
  description:
    "Semantic search over journal entries (daily notes). Use when the user asks to find when they talked about something, spot patterns in a theme, or retrieve moments tied to a specific topic or emotion.",
  execute: async ({ limit, query, threshold }) => {
    const results = await api.journal.getRelevantEntries({
      limit: limit,
      query: query,
      threshold: threshold,
    });

    return results.map((result) => ({
      content: result.chunk_markdown_text,
      date: result.date,
      link: `${env.PUBLIC_WEB_URL}/journal/${result.date}`,
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
