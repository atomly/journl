import { z } from "zod";
import { zOpenAIReasoningEffort } from "~/ai/mastra/agents/journl-agent-reasoning";

export const zWriteInput = z.strictObject({
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

export const zWriteOutput = z.object({
  status: z.enum([
    "idle",
    "prepared",
    "generating",
    "applied",
    "conflict",
    "cancelled",
    "error",
  ]),
  message: z.string(),
});
