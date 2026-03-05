import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zManipulateEditorInput } from "./schema";

export const manipulateEditor = createTool({
  description: `Modify the content of the target editor.

Use when the user wants to draft, rewrite, expand, or restructure editor content with reviewable AI suggestions.

Important:
- targetEditor must be the ID of one of the active editors and must match the expected format.
- If you do not know which active editor to use, do not call this tool and ask the user to clarify.
- This is a client-side editor action that always uses the AI draft flow (Accept / Revert in the editor).
- editorPrompt must be plain-language editing instructions (not JSON).
- intent.mode supports transform only and defaults to scope="document".
- Set scope="selection" only when the user explicitly asks to edit selected blocks.
- Always pass intent as a structured tool argument. Never JSON-encode the whole input inside editorPrompt.
- reasoningEffort is optional and controls OpenAI reasoning depth per edit. Use low for normal edits, medium for complex multi-section rewrites, and high only for the most difficult asks.

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
