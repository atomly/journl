import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zCreatePageInput } from "./schema";

export const createPage = createTool({
  description: `Create a new page with the given title.

Use when the user asks to create/add/new a page. Infer a concise, accurate title from the request and ask for clarification only when the intended title is genuinely unclear.

Do not call navigation tools after this tool; page navigation is handled automatically after creation.`,
  id: "create-page",
  inputSchema: zCreatePageInput,
  outputSchema: z.void(),
});
