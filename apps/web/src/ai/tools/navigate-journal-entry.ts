import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zNavigateJournalEntryInput } from "./navigate-journal-entry.schema";

export const navigateJournalEntry = createTool({
  description: "A client-side tool that navigates to a journal entry",
  id: "navigate-journal-entry",
  inputSchema: zNavigateJournalEntryInput,
  outputSchema: z.void(),
});
