import { eq, inArray } from "@acme/db";
import { Block, JournalEntry, Page } from "@acme/db/schema";
import z4 from "zod/v4";
import { protectedProcedure } from "../trpc.js";

export const blocksRouter = {
	// Notion-style loadPageChunk - loads blocks in chunks with pagination
	loadPageChunk: protectedProcedure
		.input(
			z4.object({
				cursor: z4.string().uuid().optional(),
				limit: z4.number().min(1).max(100).default(50),
				parentId: z4.string().uuid(),
				parentType: z4.enum(["page", "journal_entry", "block"]), // Start from this block ID
			}),
		)
		.query(async ({ ctx, input }) => {
			// First, get the parent's content array to determine order
			let parentContent: string[] = [];

			if (input.parentType === "page") {
				const [page] = await ctx.db
					.select({ content: Page.content })
					.from(Page)
					.where(eq(Page.id, input.parentId))
					.limit(1);
				parentContent = (page?.content as string[]) || [];
			} else if (input.parentType === "journal_entry") {
				const [journalEntry] = await ctx.db
					.select({ content: JournalEntry.content })
					.from(JournalEntry)
					.where(eq(JournalEntry.id, input.parentId))
					.limit(1);
				parentContent = (journalEntry?.content as string[]) || [];
			} else if (input.parentType === "block") {
				const [parentBlock] = await ctx.db
					.select({ content: Block.content })
					.from(Block)
					.where(eq(Block.id, input.parentId))
					.limit(1);
				parentContent = (parentBlock?.content as string[]) || [];
			}

			// If no content array or empty, return empty result
			if (parentContent.length === 0) {
				return {
					blocks: [],
					hasMore: false,
					nextCursor: null,
				};
			}

			// Find starting position
			let startIndex = 0;
			if (input.cursor) {
				const cursorIndex = parentContent.indexOf(input.cursor);
				if (cursorIndex !== -1) {
					startIndex = cursorIndex;
				}
			}

			// Get the chunk of block IDs
			const chunkBlockIds = parentContent.slice(
				startIndex,
				startIndex + input.limit,
			);

			// Check if there are more blocks after this chunk
			const hasMore = startIndex + input.limit < parentContent.length;
			const lastBlockId = chunkBlockIds[chunkBlockIds.length - 1];
			const nextCursor = hasMore && lastBlockId ? lastBlockId : null;

			// Get all blocks by their IDs in this chunk
			const blocks = await ctx.db
				.select()
				.from(Block)
				.where(inArray(Block.id, chunkBlockIds));

			// Sort blocks by their order in the content array
			const blockMap = new Map(blocks.map((block) => [block.id, block]));
			const sortedBlocks = chunkBlockIds
				.map((blockId) => blockMap.get(blockId))
				.filter((block) => block !== undefined);

			return {
				blocks: sortedBlocks,
				hasMore,
				nextCursor,
			};
		}),

	// Recursive loadPageChunk - loads blocks and their nested children
	loadPageChunkRecursive: protectedProcedure
		.input(
			z4.object({
				cursor: z4.string().uuid().optional(),
				limit: z4.number().min(1).max(100).default(50),
				maxDepth: z4.number().min(1).max(5).default(2),
				parentId: z4.string().uuid(),
				parentType: z4.enum(["page", "journal_entry", "block"]), // Prevent infinite recursion
			}),
		)
		.query(async ({ ctx, input }) => {
			const loadChunk = async (
				parentId: string,
				parentType: "page" | "journal_entry" | "block",
				limit: number,
				cursor?: string,
				currentDepth = 0,
			): Promise<{
				blocks: any[];
				hasMore: boolean;
				nextCursor: string | null;
			}> => {
				// First, get the parent's content array
				let parentContent: string[] = [];

				if (parentType === "page") {
					const [page] = await ctx.db
						.select({ content: Page.content })
						.from(Page)
						.where(eq(Page.id, parentId))
						.limit(1);
					parentContent = (page?.content as string[]) || [];
				} else if (parentType === "journal_entry") {
					const [journalEntry] = await ctx.db
						.select({ content: JournalEntry.content })
						.from(JournalEntry)
						.where(eq(JournalEntry.id, parentId))
						.limit(1);
					parentContent = (journalEntry?.content as string[]) || [];
				} else if (parentType === "block") {
					const [parentBlock] = await ctx.db
						.select({ content: Block.content })
						.from(Block)
						.where(eq(Block.id, parentId))
						.limit(1);
					parentContent = (parentBlock?.content as string[]) || [];
				}

				if (parentContent.length === 0) {
					return { blocks: [], hasMore: false, nextCursor: null };
				}

				// Find starting position and get chunk
				let startIndex = 0;
				if (cursor) {
					const cursorIndex = parentContent.indexOf(cursor);
					if (cursorIndex !== -1) {
						startIndex = cursorIndex;
					}
				}

				const chunkBlockIds = parentContent.slice(
					startIndex,
					startIndex + limit,
				);
				const hasMore = startIndex + limit < parentContent.length;
				const nextCursor = hasMore
					? chunkBlockIds[chunkBlockIds.length - 1]
					: null;

				// Get blocks
				const blocks = await ctx.db
					.select()
					.from(Block)
					.where(inArray(Block.id, chunkBlockIds));

				const blockMap = new Map(blocks.map((block) => [block.id, block]));
				const sortedBlocks = chunkBlockIds
					.map((blockId) => blockMap.get(blockId))
					.filter((block) => block !== undefined);

				// Recursively load children if within depth limit
				if (currentDepth < input.maxDepth) {
					for (const block of sortedBlocks) {
						const blockContent = (block.content as string[]) || [];
						if (blockContent.length > 0) {
							const childrenResult = await loadChunk(
								block.id,
								"block",
								50, // Use smaller limit for nested content
								undefined,
								currentDepth + 1,
							);
							// Attach children to block
							(block as any).children = childrenResult.blocks;
						}
					}
				}

				return { blocks: sortedBlocks, hasMore, nextCursor };
			};

			return await loadChunk(
				input.parentId,
				input.parentType,
				input.limit,
				input.cursor,
				0,
			);
		}),
};
