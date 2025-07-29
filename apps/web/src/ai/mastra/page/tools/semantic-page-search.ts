import { createTool } from "@mastra/core/tools";
import z from "zod";
import { api } from "~/trpc/server";

export const semanticPageSearch = createTool({
	description:
		"Search the pages for all entries that are semantically similar to a query. Returns multiple relevant results from different pages that should all be analyzed and synthesized.",
	execute: async ({ context }) => {
		console.debug("[semanticPageSearch] context 👀", context);

		const result = await api.pages.getRelevantPageChunks({
			limit: context.limit,
			query: context.query,
			threshold: context.threshold,
		});

		return result;
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
			page_id: z.string(),
			page_title: z.string(),
			similarity: z.number(),
		}),
	),
});
