import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zNavigatePageInput } from "./schema";

export const navigatePage = createTool({
  description: `Open a specific page by UUID only.

Use when the user asks to open or go to a specific page and the page UUID is known.

If the UUID is not known, use semanticPageSearch first to find the relevant page, then call this tool with the returned page_id. Do not use for journal-date navigation.`,
  id: "navigate-page",
  inputSchema: zNavigatePageInput,
  outputSchema: z.void(),
});
