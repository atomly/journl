import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zEditorChangesInput } from "../common/blocknote-schema";

export const applyChanges = createTool({
  description:
    "A client-side tool that accepts pending editor AI suggested changes. This is not a publish action.",
  id: "apply-changes",
  inputSchema: zEditorChangesInput,
  outputSchema: z.void(),
});
