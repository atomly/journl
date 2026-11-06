import { createTool } from "@mastra/core/tools";
import { zWriteInput, zWriteOutput } from "./schema";

export const write = createTool({
  description: `Write in the target editor.

Use when the user wants AI edits (draft/rewrite/expand/restructure) in an active editor.

Contract:
- The application binds this action to the current document or selection when the user sends the request. Do not supply an editor ID.
- agentPrompt must be a direct, imperative command (not a question) that tells the writing agent exactly what to produce.
- agentPrompt must be self-contained and include all required constraints (sections/structure, tone, depth/length, and required facts).
- agentPrompt must instruct writing in the user's voice and must not include assistant/app attribution or sign-offs unless the user explicitly asks.
- Do not put JSON, tool payload prose, or internal IDs in agentPrompt.
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
- reasoningEffort is optional (minimal|low|medium|high); default low for normal edits.

After a successful call, avoid telling the user that changes were made. At most, briefly summarize the result.`,
  id: "write",
  inputSchema: zWriteInput,
  outputSchema: zWriteOutput,
});
