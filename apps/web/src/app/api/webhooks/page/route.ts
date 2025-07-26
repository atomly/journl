import crypto from "node:crypto";
import { and, eq, inArray } from "@acme/db";
import { db } from "@acme/db/client";
import { Block, PageEmbedding, zPage } from "@acme/db/schema";
import { openai } from "@ai-sdk/openai";
import { embed } from "ai";
import { NextResponse } from "next/server";
import { handler } from "../_lib/webhook-handler";

// Optimal chunk size based on research: ~1500 characters with 300 character overlap
const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 300;

interface ChunkMetadata {
	block_ids: string[];
	chunk_size: number;
	chunk_overlap: number;
	total_blocks_in_page: number;
}

interface BlockWithText {
	id: string;
	text: string;
	startPosition: number;
	endPosition: number;
}

interface TextChunkWithMetadata {
	text: string;
	blockIds: string[];
}

/**
 * Chunks text into overlapping segments while tracking which blocks contribute to each chunk
 */
function chunkTextWithBlockMetadata(
	blocksWithText: BlockWithText[],
): TextChunkWithMetadata[] {
	// Combine all text to get the full content
	const fullText = blocksWithText.map((b) => b.text).join("\n");

	if (fullText.length <= CHUNK_SIZE) {
		return [
			{
				blockIds: blocksWithText.map((b) => b.id),
				text: fullText,
			},
		];
	}

	const chunks: TextChunkWithMetadata[] = [];
	let start = 0;

	while (start < fullText.length) {
		const end = Math.min(start + CHUNK_SIZE, fullText.length);
		let chunkEnd = end;

		// Try to break at sentence boundaries to preserve meaning
		if (end < fullText.length) {
			const sentenceBreak = fullText.lastIndexOf(". ", end);
			const questionBreak = fullText.lastIndexOf("? ", end);
			const exclamationBreak = fullText.lastIndexOf("! ", end);

			const lastSentenceBreak = Math.max(
				sentenceBreak,
				questionBreak,
				exclamationBreak,
			);

			// Only use sentence break if it's not too far back (at least 50% of chunk size)
			if (lastSentenceBreak > start + CHUNK_SIZE * 0.5) {
				chunkEnd = lastSentenceBreak + 2; // Include the punctuation and space
			}
		}

		const chunkText = fullText.slice(start, chunkEnd).trim();
		if (chunkText) {
			// Find which blocks contribute to this chunk
			const contributingBlockIds = new Set<string>();

			for (const block of blocksWithText) {
				// Check if this block's text overlaps with the current chunk
				const blockOverlapsChunk =
					block.startPosition < chunkEnd && block.endPosition > start;

				if (blockOverlapsChunk) {
					contributingBlockIds.add(block.id);
				}
			}

			chunks.push({
				blockIds: Array.from(contributingBlockIds),
				text: chunkText,
			});
		}

		// Move start position with overlap, but ensure we make progress
		start = Math.max(start + 1, chunkEnd - CHUNK_OVERLAP);

		// Prevent infinite loop
		if (start >= fullText.length) {
			break;
		}
	}

	return chunks;
}

/**
 * Recursively collects all child block IDs for a given block
 */
async function collectChildBlockIds(blockId: string): Promise<string[]> {
	const block = await db
		.select({ children: Block.children })
		.from(Block)
		.where(eq(Block.id, blockId))
		.limit(1);

	if (!block[0]) return [];

	const childIds = (block[0].children as string[]) || [];
	const allChildIds = [...childIds];

	// Recursively collect children of children
	for (const childId of childIds) {
		const grandChildIds = await collectChildBlockIds(childId);
		allChildIds.push(...grandChildIds);
	}

	return allChildIds;
}

/**
 * Extracts text content from block content structure
 */
function extractTextFromBlock(content: any): string {
	if (!content || !Array.isArray(content)) {
		return "";
	}

	return content
		.map((item: any) => {
			if (typeof item === "string") {
				return item;
			}
			if (item && typeof item === "object" && item.text) {
				return item.text;
			}
			return "";
		})
		.filter(Boolean)
		.join(" ");
}

export const POST = handler(zPage, async (payload) => {
	if (payload.type === "INSERT" || payload.type === "UPDATE") {
		const pageId = payload.record.id;
		const userId = payload.record.user_id;

		// Get all direct child blocks of the page
		const pageChildren = (payload.record.children as string[]) || [];

		if (pageChildren.length === 0) {
			console.debug("Skipping embedding for page with no blocks", pageId);
			return NextResponse.json({ success: true });
		}

		// Collect all nested child block IDs
		const allBlockIds: string[] = [...pageChildren];
		for (const childId of pageChildren) {
			const nestedChildIds = await collectChildBlockIds(childId);
			allBlockIds.push(...nestedChildIds);
		}

		// Fetch all blocks for the page
		const blocks = await db
			.select()
			.from(Block)
			.where(and(inArray(Block.id, allBlockIds), eq(Block.created_by, userId)));

		// Extract text content from all blocks and track positions
		const blocksWithText: BlockWithText[] = [];
		let currentPosition = 0;

		for (const block of blocks) {
			const blockText = extractTextFromBlock(block.content);
			if (blockText) {
				const startPosition = currentPosition;
				const endPosition = currentPosition + blockText.length + 1; // +1 for newline

				blocksWithText.push({
					endPosition,
					id: block.id,
					startPosition,
					text: blockText,
				});

				currentPosition = endPosition;
			}
		}

		// Skip embedding if there's no meaningful text content
		if (blocksWithText.length === 0) {
			console.debug("Skipping embedding for page with no text content", pageId);
			return NextResponse.json({ success: true });
		}

		// Create combined text for hashing
		const allText = blocksWithText.map((b) => b.text).join("\n");

		// Create a SHA-256 hash of the combined text content for change detection
		const pageTextHash = crypto
			.createHash("sha256")
			.update(allText, "utf8")
			.digest("hex");

		// Check if we already have embeddings for this content
		const existingEmbeddings = await db
			.select({ id: PageEmbedding.id })
			.from(PageEmbedding)
			.where(
				and(
					eq(PageEmbedding.page_id, pageId),
					eq(PageEmbedding.page_text_hash, pageTextHash),
				),
			)
			.limit(1);

		if (existingEmbeddings.length > 0) {
			console.debug(
				"Page content unchanged, skipping embedding update",
				pageId,
			);
			return NextResponse.json({ success: true });
		}

		// Delete existing embeddings for this page (content has changed)
		await db.delete(PageEmbedding).where(eq(PageEmbedding.page_id, pageId));

		// Chunk the text content with block metadata
		const textChunks = chunkTextWithBlockMetadata(blocksWithText);

		// Create embeddings for each chunk
		const embeddingPromises = textChunks.map(async (chunk, index) => {
			const { embedding } = await embed({
				maxRetries: 5,
				model: openai.embedding("text-embedding-3-small"),
				value: chunk.text,
			});

			// Create metadata for this chunk
			const metadata: ChunkMetadata = {
				block_ids: chunk.blockIds,
				chunk_overlap: CHUNK_OVERLAP,
				chunk_size: chunk.text.length,
				total_blocks_in_page: blocksWithText.length,
			};

			return {
				chunk_index: index,
				chunk_text: chunk.text,
				embedding,
				metadata,
				page_id: pageId,
				page_text_hash: pageTextHash,
				user_id: userId,
			};
		});

		// Wait for all embeddings to be generated
		const embeddingData = await Promise.all(embeddingPromises);

		// Insert all embeddings in a single transaction
		await db.insert(PageEmbedding).values(embeddingData);

		console.debug(
			`Page embeddings stored for page ${pageId}: ${textChunks.length} chunks, ${allText.length} characters`,
		);
	}

	return NextResponse.json({ success: true });
});
