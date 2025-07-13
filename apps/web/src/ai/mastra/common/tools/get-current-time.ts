import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const getCurrentTime = createTool({
	description: "Get the current time",
	execute: async () => {
		console.debug("[getCurrentTime] executing");
		return new Date().toISOString();
	},
	id: "get-current-time",
	outputSchema: z.string(),
});
