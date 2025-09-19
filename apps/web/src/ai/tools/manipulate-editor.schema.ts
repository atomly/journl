import { z } from "zod";

export const zManipulateEditorInput = z.object({
  targetEditor: z
    .string()
    .describe(
      "The target editor to manipulate. It is the date of a journal entry (in YYYY-MM-DD format) or a page ID (UUID format).",
    ),
  userPrompt: z
    .string()
    .describe("The user prompt to use for the editor's LLM call."),
});
