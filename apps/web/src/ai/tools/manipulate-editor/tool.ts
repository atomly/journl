import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zManipulateEditorInput } from "./schema";

export const manipulateEditor = createTool({
  description: `Modify the content of the target editor.

Use when the user wants to write, add, insert, capture, log, note, format, structure, replace, or transform editor content.

Important:
- targetEditor must be the ID of one of the active editors and must match the expected format.
- If you do not know which active editor to use, do not call this tool and ask the user to clarify.
- This is a client-side editor action, so the editorPrompt should include as much detail as possible.

Rules:
- Do not use for pure recall or analysis of prior notes; use search tools instead.
- Do not add page titles in editor content; titles are managed separately.
- Do not fabricate prior notes, pages, links, or any content not found in user data.
- Do not generate markdown explicitly; the editor handles formatting.

After a successful call, avoid telling the user that changes were made. At most, briefly summarize the result.`,
  id: "manipulate-editor",
  inputSchema: zManipulateEditorInput,
  outputSchema: z.void(),
});
