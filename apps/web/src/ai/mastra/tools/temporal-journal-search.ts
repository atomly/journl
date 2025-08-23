import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { api } from "~/trpc/server";

export const temporalJournalSearch = createTool({
  description: "Search the journal for entries between two dates",
  execute: async ({ context }) => {
    console.debug("[temporalJournalSearch] context 👀", context);

    const results = await api.journal.getBetween({
      from: context.from,
      to: context.to,
    });

    return results.map((result) => ({
      ...result,
      link: `/journal/${result.date}`,
    }));
  },
  id: "temporal-journal-search",
  inputSchema: z.object({
    from: z
      .string()
      .describe(
        "The start date of the search in ISO 8601 format (YYYY-MM-DD for dates and YYYY-MM-DDThh:mm:ssTZD)",
      ),
    to: z
      .string()
      .describe(
        "The end date of the search in ISO 8601 format (YYYY-MM-DD for dates and YYYY-MM-DDThh:mm:ssTZD)",
      ),
  }),
  outputSchema: z.array(
    z.object({
      content: z.string(),
      date: z.string(),
      id: z.string(),
    }),
  ),
});
