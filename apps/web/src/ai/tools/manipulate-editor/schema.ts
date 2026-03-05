import { z } from "zod";
import { zJournlEditorId } from "~/ai/agents/journl-agent";
import { zOpenAIReasoningEffort } from "~/ai/agents/journl-agent-reasoning";

export const zManipulateEditorInput = z.object({
  targetEditor: zJournlEditorId,
  userPrompt: z
    .string()
    .describe(
      "Instruction for editor changes. Use plain-language editing instructions, not JSON payloads.",
    ),
  reasoningEffort: z
    .optional(zOpenAIReasoningEffort)
    .describe(
      "Optional reasoning effort for this edit. Use `low` for normal edits, `medium` for multi-section rewrites, and `high` for the most complex asks. Defaults to `low` if omitted.",
    ),
});

export type ManipulateEditorInput = z.infer<typeof zManipulateEditorInput>;
