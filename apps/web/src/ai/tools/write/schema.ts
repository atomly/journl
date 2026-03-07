import { z } from "zod";
import { zJournlEditorId } from "~/ai/mastra/agents/journl-agent-context";
import { zOpenAIReasoningEffort } from "~/ai/mastra/agents/journl-agent-reasoning";

export const zWriteInput = z.object({
  targetEditor: zJournlEditorId,
  agentPrompt: z
    .string()
    .describe(
      "Instructions for the writing agent that will manipulate the editor. Use a direct imperative command (not a question), and include required sections, tone, depth, and must-include facts.",
    ),
  reasoningEffort: z
    .optional(zOpenAIReasoningEffort)
    .describe(
      "Optional reasoning effort for this edit. Use `low` for normal edits, `medium` for multi-section rewrites, and `high` for the most complex asks. Defaults to `low` if omitted.",
    ),
});

export type WriteInput = z.infer<typeof zWriteInput>;
