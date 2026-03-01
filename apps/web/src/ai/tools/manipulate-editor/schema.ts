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
  .discriminatedUnion("mode", [
    z.object({
      mode: z.literal("transform").describe("Use BlockNote AI to draft edits."),
      operation: z
        .string()
        .optional()
        .describe(
          "Optional short operation label, for example `rewrite`, `expand`, or `restructure`.",
        ),
    }),
    z.object({
      content: z
        .string()
        .min(1)
        .describe(
          "Exact body content to write to the editor. Keep it title-free because page titles are managed separately.",
        ),
      format: z
        .enum(["markdown", "plain-text"])
        .optional()
        .describe(
          "Formatting of `content`. Defaults to `markdown` when omitted.",
        ),
      mode: z
        .literal("replace")
        .describe(
          "Bypass BlockNote AI and replace the editor body deterministically with `content`.",
        ),
    }),
  ])
  .describe(
    "V2 editor intent contract. Prefer `replace` when you already have exact body content in the conversation.",
  );

export const zLegacyEditorIntent = z
  .enum(["transform", "replace"])
  .describe(
    'Legacy shorthand for intent. `transform` is equivalent to `{ mode: "transform" }`. `replace` is accepted for compatibility and treated as transform unless full replace payload is provided.',
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
      "Instruction for editor changes. For `intent.mode=replace`, this is still required and should explain source and constraints.",
    ),
});
