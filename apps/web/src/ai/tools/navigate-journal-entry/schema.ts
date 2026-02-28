import { z } from "zod";

export const zNavigateJournalEntryInput = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("The date of the journal entry in YYYY-MM-DD format."),
});
