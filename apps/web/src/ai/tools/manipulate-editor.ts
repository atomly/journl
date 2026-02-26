import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getJournlRequestContext } from "../agents/journl-agent";
import { zManipulateEditorInput } from "./manipulate-editor.schema";

export const manipulateEditor = createTool({
  description: `Modify the content of a currently active editor.

Use this when the user wants to write, insert, capture, format, structure, replace, or transform editor content. This is a client-side editor action, so provide a detailed editorPrompt with all needed instructions.

Rules:
- targetEditor must be one of the active editor IDs and must match the expected format.
- Do not use for pure recall or analysis of prior notes; use search tools instead.
- Do not add page titles in editor content; titles are managed separately.
- Do not fabricate prior notes, pages, links, or any content not found in user data.
- Do not generate markdown explicitly; the editor handles formatting.`,
  execute: async ({ targetEditor }, { requestContext }) => {
    const context = getJournlRequestContext(requestContext);
    if (!context?.activeEditors.length) {
      throw new Error("There are no active editors to manipulate.");
    }
    const editor = context.activeEditors.some(
      (editor) => editor === targetEditor,
    );
    if (!editor) {
      throw new Error(
        `Editor with ID ${targetEditor} not found, the available editors are: ${JSON.stringify(context.activeEditors)}`,
      );
    }
  },
  id: "manipulate-editor",
  inputSchema: zManipulateEditorInput,
  outputSchema: z.void(),
});
