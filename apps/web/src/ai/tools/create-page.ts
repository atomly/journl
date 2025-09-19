import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zCreatePageInput } from "./create-page.schema";

export const createPage = createTool({
  description: "A client-side tool that creates a new page",
  id: "create-page",
  inputSchema: zCreatePageInput,
  outputSchema: z.void(),
});
