import { db } from "@acme/db/client";
import { JournalEmbedding, zJournalEntry } from "@acme/db/schema";
import { openai } from "@ai-sdk/openai";
import { embed } from "ai";
import { NextResponse } from "next/server";
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

		// TODO: Chunk the journal entries.
		const { embedding } = await embed({
			maxRetries: 5,
			model: openai.embedding("text-embedding-3-small"),
			value: payload.record.content,
		});

		// Store the embedding in the database
		await db
			.insert(JournalEmbedding)
			.values({
				chunk_text: payload.record.content,
				date: payload.record.date,
				embedding,
				journal_entry_id: payload.record.id,
				user_id: payload.record.user_id,
			})
			.onConflictDoUpdate({
				set: {
					chunk_text: payload.record.content,
					embedding,
				},
				target: [JournalEmbedding.journal_entry_id],
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
