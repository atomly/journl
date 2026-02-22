import { blocknoteMarkdown } from "@acme/blocknote/server";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { env } from "~/env";
import { api } from "~/trpc/server";

export const temporalJournalSearch = createTool({
  description: "Search the journal for entries between two dates",
  execute: async ({ from, to }) => {
    const results = await api.journal.getBetween({
      from: from,
      to: to,
    });

    return await Promise.all(
      results.map(async (result) => {
        const markdown = result.blocks
          ? await blocknoteMarkdown(result.blocks)
          : "";
        return {
          content: markdown,
          date: result.date,
          id: result.id,
          link: `${env.PUBLIC_WEB_URL}/journal/${result.date}`,
        };
      }),
    );
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
      link: z.string(),
    }),
  ),
});
