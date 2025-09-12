import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zNavigatePageInput } from "./navigate-page.schema";

export const navigatePage = createTool({
  description: "A client-side tool that navigates to a page",
  id: "navigate-page",
  inputSchema: zNavigatePageInput,
  outputSchema: z.void(),
});
