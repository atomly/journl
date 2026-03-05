import { z } from "zod";
import type { JournlAgentState } from "../../agents/journl-agent-state";

const JOURNAL_ENTRY_ID_PATTERN = /^journal-entry:\d{4}-\d{2}-\d{2}$/;
const PAGE_ID_PATTERN = /^page:.+$/;

export const zTargetEditor = z
  .custom<JournlAgentState["activeEditors"][number]>((value) => {
    if (typeof value !== "string") {
      return false;
    }
    return JOURNAL_ENTRY_ID_PATTERN.test(value) || PAGE_ID_PATTERN.test(value);
  }, "Expected `journal-entry:{YYYY-MM-DD}` or `page:{ID}`.")
  .describe(
    "The target editor to manipulate. Format: `journal-entry:{YYYY-MM-DD}` or `page:{ID}`.",
  );

export const zEditorIntent = z
  .object({
    mode: z.literal("transform").describe("Use BlockNote AI to draft edits."),
    operation: z
      .string()
      .optional()
      .describe(
        "Optional short operation label, for example `rewrite`, `expand`, or `restructure`.",
      ),
    scope: z
      .enum(["document", "selection"])
      .optional()
      .describe(
        "Target scope for transform edits. Defaults to `document` to avoid accidental selection-only rewrites.",
      ),
  })
  .describe(
    "Editor intent contract. Uses AI-assisted transform mode with optional scope.",
  );

export const zLegacyEditorIntent = z
  .literal("transform")
  .describe(
    'Legacy shorthand for intent. `transform` is equivalent to `{ mode: "transform" }`.',
  );

export const zOpenAIReasoningEffort = z
  .enum(["minimal", "low", "medium", "high"])
  .describe(
    "OpenAI reasoning effort for this editor operation. Use `low` for normal edits, `medium` for multi-section rewrites, and `high` for the most complex asks.",
  );

export const zManipulateEditorInput = z.object({
  intent: z
    .optional(z.union([zEditorIntent, zLegacyEditorIntent]))
    .describe(
      "Optional V2 editor intent contract. If omitted, defaults to AI transform mode using `editorPrompt`.",
    ),
  targetEditor: zTargetEditor,
  editorPrompt: z
    .string()
    .describe(
      "Instruction for editor changes. Use plain-language editing instructions, not JSON payloads.",
    ),
  reasoningEffort: z
    .optional(zOpenAIReasoningEffort)
    .describe(
      "Optional OpenAI reasoning effort for this edit. Defaults to `low` if omitted.",
    ),
});
