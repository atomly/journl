import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zEditorChangesInput } from "../editor-changes/schema";

export const rejectEditorChanges = createTool({
  description:
    "A client-side tool that rejects pending editor AI suggested changes.",
  id: "reject-editor-changes",
  inputSchema: zEditorChangesInput,
  outputSchema: z.void(),
});
