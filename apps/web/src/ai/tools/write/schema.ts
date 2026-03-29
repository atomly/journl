import { z } from "zod";
import { zJournlEditorId } from "~/ai/mastra/agents/journl-agent-context";
import { zOpenAIReasoningEffort } from "~/ai/mastra/agents/journl-agent-reasoning";

export const zWriteInput = z.object({
  targetEditor: zJournlEditorId,
  agentPrompt: z
    .string()
    .describe(
      "Instructions for the writing agent that will manipulate the editor. Use a direct imperative command (not a question), avoid assistant/app sign-offs unless explicitly requested.",
    ),
  reasoningEffort: z
    .optional(zOpenAIReasoningEffort)
    .describe(
      "Optional reasoning effort for this edit. Use `minimal` for normal edits, `low` for multi-section rewrites, and `medium` for complex tasks, or `high` for the most creative asks. Defaults to `minimal` if omitted.",
    ),
});

export type WriteInput = z.infer<typeof zWriteInput>;
