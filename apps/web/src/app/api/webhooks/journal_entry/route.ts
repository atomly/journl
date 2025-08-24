import { zJournalEntry } from "@acme/db/schema";
import { NextResponse } from "next/server";
import { api } from "~/trpc/server";
import { handler } from "../_lib/webhook-handler";

/**
 * Handles Supabase webhook payloads for journal entries
 */
export const POST = handler(zJournalEntry, async (payload) => {
  if (payload.type === "INSERT" || payload.type === "UPDATE") {
    if (!payload.record.content) {
      return NextResponse.json(
        { error: "No content", success: false },
        { status: 400 },
      );
    }

    // Call the usage procedure to create the embedding and track usage
    await api.ai.createJournalEmbedding({
      content: payload.record.content,
      date: payload.record.date,
      journalEntryId: payload.record.id,
      model: "text-embedding-3-small",
      provider: "openai",
      userId: payload.record.user_id,
    });

    console.debug(
      "Embedding stored for journal entry",
      payload.record.id,
      "of date",
      payload.record.date,
    );
  }

  return NextResponse.json({ success: true });
});
