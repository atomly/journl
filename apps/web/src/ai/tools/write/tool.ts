import { createTool } from "@mastra/core/tools";
import { zWriteInput, zWriteOutput } from "./schema";

export const write = createTool({
  description: `Write in the target editor.

Use when the user wants AI edits (draft/rewrite/expand/restructure) in an active editor, including writing based on current public-web research.
The writer can cite supplied findings but cannot search. For requested current public research, call webSearch first and then write. Reuse completed findings instead of repeating research.

Contract:
- The application binds this action to the current document or selection when the user sends the request. Do not supply an editor ID.
- This tool takes no arguments. The application supplies the user's original request and recent conversation text to the writer. Do not rewrite, expand, or reinterpret the task in tool arguments.
- Scope is the highlighted text when present, otherwise the current document.
- Preview is transient. Completed validated edits apply automatically with normal Undo.
- The editor is locked while blocks stream inline. Cancellation or failure preserves the original writing.
- Never automatically retry a failed or cancelled edit.

Navigation:
- Create or navigate to a page first if requested. The application waits for its editor and binds writing to that destination.
- Never guess a target from a page ID or title in conversation history.

Constraints:
- Do not use for recall/analysis tasks; use search tools.
- Do not add page titles in body content unless explicitly requested.
- Do not fabricate facts, pages, or links.

After a successful call, avoid telling the user that changes were made. At most, briefly summarize the result.`,
  id: "write",
  inputSchema: zWriteInput,
  outputSchema: zWriteOutput,
  strict: true,
});
