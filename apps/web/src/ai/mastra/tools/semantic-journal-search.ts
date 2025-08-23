import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { api } from "~/trpc/server";

export const semanticJournalSearch = createTool({
  description:
    "Search the journal for entries that are semantically similar to a query",
  execute: async ({ context }) => {
    console.debug("[semanticJournalSearch] context 👀", context);

    const results = await api.journal.getRelevantEntries({
      limit: context.limit,
      query: context.query,
      threshold: context.threshold,
    });

    return results.map((result) => ({
      ...result,
      link: `/journal/${result.date}`,
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
      id: z.string(),
      similarity: z.number(),
    }),
  ),
});
