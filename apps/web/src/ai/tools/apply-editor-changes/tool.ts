import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zEditorChangesInput } from "../editor-changes/schema";

export const applyEditorChanges = createTool({
  description:
    "A client-side tool that accepts pending editor AI suggested changes.",
  id: "apply-editor-changes",
  inputSchema: zEditorChangesInput,
  outputSchema: z.void(),
});
