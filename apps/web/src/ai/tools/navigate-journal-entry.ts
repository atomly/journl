import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { zNavigateJournalEntryInput } from "./navigate-journal-entry.schema";

export const navigateJournalEntry = createTool({
  description: `Open a journal entry by date (YYYY-MM-DD).

Use when the user asks to open or go to a specific journal date (for example: today, yesterday, last Monday, or an explicit date).

Do not use this tool for named pages or page UUID navigation requests.`,
  id: "navigate-journal-entry",
  inputSchema: zNavigateJournalEntryInput,
  outputSchema: z.void(),
});
