import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zWriteInput } from "./schema";

export const write = createTool({
  description: `Write in the target editor.

Use when the user wants reviewable AI edits (draft/rewrite/expand/restructure) in an active editor.

Contract:
- targetEditor must be a valid active editor id.
- agentPrompt must be a direct, imperative command (not a question) that tells the writing agent exactly what to produce.
- agentPrompt must be self-contained and include all required constraints (sections/structure, tone, depth/length, and required facts).
- agentPrompt must instruct writing in the user's voice and must not include assistant/app attribution or sign-offs unless the user explicitly asks.
- Do not put JSON, tool payload prose, or internal IDs in agentPrompt.
- This tool uses the draft flow (Accept / Revert in editor).
- Use "accept changes" and "reject changes" terminology, not publishing terms.

Chaining from createPage:
- If write follows createPage in the same run, derive targetEditor from createPage output from that run.
- Prefer output.targetEditor. If unavailable, derive page:<id> from output.page.id.
- Never use a page title as targetEditor.

Constraints:
- Do not use for recall/analysis tasks; use search tools.
- Do not add page titles in body content unless explicitly requested.
- Do not fabricate facts, pages, or links.
- reasoningEffort is optional (minimal|low|medium|high); default low for normal edits.

After a successful call, avoid telling the user that changes were made. At most, briefly summarize the result.`,
  id: "write",
  inputSchema: zWriteInput,
  outputSchema: z.void(),
});
