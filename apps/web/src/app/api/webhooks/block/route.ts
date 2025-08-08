import crypto from "node:crypto";
import { db } from "@acme/db/client";
import { BlockEmbedding, zBlock } from "@acme/db/schema";
import { openai } from "@ai-sdk/openai";
import { embed } from "ai";
import { NextResponse } from "next/server";
import { handler } from "../_lib/webhook-handler";

export const POST = handler(zBlock, async (payload) => {
	if (payload.type === "INSERT" || payload.type === "UPDATE") {
		const textContent = payload.record.content
			.map((block: any) => block.text)
			.filter(Boolean) // Remove empty/null/undefined text
			.join("\n")
			.trim();

		// Skip embedding if there's no meaningful text content
		if (!textContent) {
			console.debug(
				"Skipping embedding for block with no text content",
				payload.record.id,
			);
			return NextResponse.json({ success: true });
		}

		// Create a SHA-256 hash of the text content for change detection
		const textHash = crypto
			.createHash("sha256")
			.update(textContent, "utf8")
			.digest("hex");

		const { embedding } = await embed({
			maxRetries: 5,
			model: openai.embedding("text-embedding-3-small"),
			value: textContent,
		});

		await db
			.insert(BlockEmbedding)
			.values({
				block_id: payload.record.id,
				embedding,
				parent_id: payload.record.parent_id,
				parent_type: payload.record.parent_type,
				text_hash: textHash,
				user_id: payload.record.created_by,
			})
			.onConflictDoUpdate({
				set: {
					embedding,
					text_hash: textHash,
				},
				target: [BlockEmbedding.block_id],
			});

		console.debug("Block embedding stored for block", payload.record.id);
	}

	return NextResponse.json({ success: true });
});
