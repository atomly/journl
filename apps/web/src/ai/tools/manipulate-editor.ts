import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zManipulateEditorInput } from "./manipulate-editor.schema";

export const manipulateEditor = createTool({
  description: "A client-side tool that manipulates the block editor",
  id: "manipulate-editor",
  inputSchema: zManipulateEditorInput,
  outputSchema: z.void(),
});
