import { z } from "zod";

export const zManipulateEditorInput = z.object({
  editorId: z
    .string()
    .describe(
      "The ID of one of the active editors to manipulate. It is the date of a journal entry (in YYYY-MM-DD format) or a page ID (UUID).",
    ),
  userPrompt: z
    .string()
    .describe("The user prompt to use for the editor's LLM call."),
});
