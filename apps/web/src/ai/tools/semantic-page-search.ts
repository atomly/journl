import { createTool } from "@mastra/core/tools";
import z from "zod";
import { env } from "~/env";
import { api } from "~/trpc/server";

export const semanticPageSearch = createTool({
  description:
    "Search the pages for all entries that are semantically similar to a query. Returns multiple relevant results from different pages that should all be analyzed and synthesized.",
  execute: async ({ limit, query, threshold }) => {
    const result = await api.pages.getRelevantPages({
      limit: limit,
      query: query,
      threshold: threshold,
    });

    return result.map((result) => ({
      content: result.embedding.chunk_markdown_text,
      link: `${env.PUBLIC_WEB_URL}/pages/${result.page.id}`,
      page_id: result.page.id,
      page_title: result.page.title,
      similarity: result.similarity,
    }));
  },
  id: "semantic-page-search",
  inputSchema: z.object({
    limit: z.number().describe("The number of results to return").default(5),
    query: z.string().describe("The query to search the pages for"),
    threshold: z
      .number()
      .describe("The similarity threshold to return results")
      .default(0.1),
  }),
  outputSchema: z.array(
    z.object({
      content: z.string(),
      link: z.string(),
      page_id: z.string(),
      page_title: z.string(),
      similarity: z.number(),
    }),
  ),
});
