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

export const zManipulateEditorInput = z.object({
  targetEditor: zTargetEditor,
  editorPrompt: z
    .string()
    .describe(
      "The prompt to pass to the editor's agent. It is better to provide as much detail as possible.",
    ),
});
