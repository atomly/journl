import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zEditorChangesInput } from "../common/blocknote-schema";

export const rejectChanges = createTool({
  description:
    "A client-side tool that rejects pending editor AI suggested changes. This is not a publish action.",
  id: "reject-editor-changes",
  inputSchema: zEditorChangesInput,
  outputSchema: z.void(),
});
