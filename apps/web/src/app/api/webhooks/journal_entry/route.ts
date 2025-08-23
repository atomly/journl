import { db, insertEmbeddingTokenUsage } from "@acme/db";
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

		const { embedding, usage } = await embed({
			maxRetries: 5,
			model: openai.embedding("text-embedding-3-small"),
			value: payload.record.content,
		});

		await db.transaction(async (tx) => {
			// Store token usage with automatic pricing calculation
			await insertEmbeddingTokenUsage(tx, {
				metadata: {
					content_id: payload.record.id,
					content_type: "journal_entry",
				},
				model: "text-embedding-3-small",
				provider: "openai",
				tokenCount: usage.tokens,
				userId: payload.record.user_id,
			});

			await tx
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
