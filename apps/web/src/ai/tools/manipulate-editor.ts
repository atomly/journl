import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getJournlRuntimeContext } from "../agents/journl-agent";
import { zManipulateEditorInput } from "./manipulate-editor.schema";

export const manipulateEditor = createTool({
  description: "A client-side tool that manipulates the block editor",
  execute: async ({ context: { targetEditor: editorId }, runtimeContext }) => {
    const context = getJournlRuntimeContext(runtimeContext);
    if (!context.activeEditors.length) {
      throw new Error("There are no active editors to manipulate.");
    }
    const editor = context.activeEditors.some((editor) =>
      editor.type === "journal-entry"
        ? editor.date === editorId
        : editor.id === editorId,
    );
    if (!editor) {
      throw new Error(
        `Editor with ID ${editorId} not found, the available editors are: ${JSON.stringify(context.activeEditors)}`,
      );
    }
  },
  id: "manipulate-editor",
  inputSchema: zManipulateEditorInput,
  outputSchema: z.void(),
});
