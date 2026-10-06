import { pgSequence } from "drizzle-orm/pg-core";

// Mastra owns the memory_messages table, so it is excluded from Drizzle's
// table diff. Declare its owned sequence explicitly so `drizzle-kit push`
// doesn't treat it as an orphan and try to drop it.
export const memoryMessagesIdSequence = pgSequence("memory_messages_id_seq", {
  maxValue: 2_147_483_647,
});
