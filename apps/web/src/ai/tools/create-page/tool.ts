import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zCreatePageInput } from "./schema";

export const createPage = createTool({
  description: `Create a new page with the given title.

Use only when the latest user request asks to create a separate page. Writing on an already-open page, including a new or empty page, uses write without creating another page. For example, "write on this new page" means the current page, while "create another page and write there" requires creation.

Infer a concise, accurate title from an actual creation request and ask for clarification only when the intended title is unclear.

If the user asks to create and write in the same request, chain this tool immediately with write. The application binds writing to the new page automatically.

Page navigation is handled automatically after creation. If editorReady is true, do not call navigation tools. If editorReady is false, the page was still created successfully: call navigatePage with the returned page ID to wait for that same editor, then write. Never create a replacement page to recover from a loading delay.`,
  id: "create-page",
  inputSchema: zCreatePageInput,
  outputSchema: z.void(),
});
