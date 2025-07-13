import { eq, inArray } from "@acme/db";
import { Block, Page } from "@acme/db/schema";
import { z } from "zod/v4";
import { protectedProcedure } from "../trpc.js";

export const blocksRouter = {
	// Create block and update parent's content array (Notion-style transaction)
	create: protectedProcedure
		.input(
			z.object({
				insertIndex: z.number().min(0).optional(),
				parentId: z.string().uuid(),
				parentType: z.enum(["page", "journal_entry", "block"]),
				properties: z.record(z.string(), z.any()).default({}),
				type: z.enum([
					"paragraph",
					"heading_1",
					"heading_2",
					"heading_3",
					"list_item",
					"todo",
					"toggle",
					"code",
					"quote",
					"callout",
					"divider",
					"image",
					"link",
				]), // Where to insert in parent's content array
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return await ctx.db.transaction(async (tx) => {
				// 1. Create the block
				const [newBlock] = await tx
					.insert(Block)
					.values({
						content: [],
						created_by: ctx.session.user.id,
						parent_id: input.parentId,
						parent_type: input.parentType,
						properties: input.properties,
						type: input.type,
					})
					.returning();

				if (!newBlock) {
					throw new Error("Failed to create block");
				}

				// 2. Update parent's content array
				if (input.parentType === "page") {
					const [page] = await tx
						.select({ content: Page.content })
						.from(Page)
						.where(eq(Page.id, input.parentId))
						.limit(1);

					const currentContent = (page?.content as string[]) || [];
					const insertAt = input.insertIndex ?? currentContent.length;
					const newContent = [...currentContent];
					newContent.splice(insertAt, 0, newBlock.id);

					await tx
						.update(Page)
						.set({ content: newContent })
						.where(eq(Page.id, input.parentId));
				}
				// else if (input.parentType === "journal_entry") {
				// 	const [journalEntry] = await tx
				// 		.select({ content: JournalEntry.content })
				// 		.from(JournalEntry)
				// 		.where(eq(JournalEntry.id, input.parentId))
				// 		.limit(1);

				// 	const currentContent = (journalEntry?.content as string[]) || [];
				// 	const insertAt = input.insertIndex ?? currentContent.length;
				// 	const newContent = [...currentContent];
				// 	newContent.splice(insertAt, 0, newBlock.id);

				// 	await tx
				// 		.update(JournalEntry)
				// 		.set({ content: newContent })
				// 		.where(eq(JournalEntry.id, input.parentId));
				// }
				else if (input.parentType === "block") {
					const [parentBlock] = await tx
						.select({ content: Block.content })
						.from(Block)
						.where(eq(Block.id, input.parentId))
						.limit(1);

					const currentContent = (parentBlock?.content as string[]) || [];
					const insertAt = input.insertIndex ?? currentContent.length;
					const newContent = [...currentContent];
					newContent.splice(insertAt, 0, newBlock.id);

					await tx
						.update(Block)
						.set({ content: newContent })
						.where(eq(Block.id, input.parentId));
				}

				return newBlock;
			});
		}),
	// Notion-style loadPageChunk - loads blocks in chunks with pagination
	loadPageChunk: protectedProcedure
		.input(
			z.object({
				cursor: z.string().uuid().optional(),
				limit: z.number().min(1).max(100).default(50),
				parentId: z.string().uuid(),
				parentType: z.enum(["page", "journal_entry", "block"]), // Start from this block ID
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
			}
			// else if (input.parentType === "journal_entry") {
			// 	const [journalEntry] = await ctx.db
			// 		.select({ content: JournalEntry.content })
			// 		.from(JournalEntry)
			// 		.where(eq(JournalEntry.id, input.parentId))
			// 		.limit(1);
			// 	parentContent = (journalEntry?.content as string[]) || [];
			// }
			else if (input.parentType === "block") {
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
			z.object({
				cursor: z.string().uuid().optional(),
				limit: z.number().min(1).max(100).default(50),
				maxDepth: z.number().min(1).max(5).default(2),
				parentId: z.string().uuid(),
				parentType: z.enum(["page", "journal_entry", "block"]), // Prevent infinite recursion
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
				blocks: (typeof Block.$inferSelect)[];
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
				}
				// else if (parentType === "journal_entry") {
				// 	const [journalEntry] = await ctx.db
				// 		.select({ content: JournalEntry.content })
				// 		.from(JournalEntry)
				// 		.where(eq(JournalEntry.id, parentId))
				// 		.limit(1);
				// 	parentContent = (journalEntry?.content as string[]) || [];
				// }
				else if (parentType === "block") {
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
				const lastBlockId = chunkBlockIds[chunkBlockIds.length - 1];
				const nextCursor = hasMore && lastBlockId ? lastBlockId : null;

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
							(
								block as typeof Block.$inferSelect & {
									children?: (typeof Block.$inferSelect)[];
								}
							).children = childrenResult.blocks;
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

	// Move block (change order or parent) - Notion-style structural operation
	move: protectedProcedure
		.input(
			z.object({
				blockId: z.string().uuid(),
				newIndex: z.number().min(0),
				newParentId: z.string().uuid(),
				newParentType: z.enum(["page", "journal_entry", "block"]),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return await ctx.db.transaction(async (tx) => {
				// 1. Get the block to move
				const [blockToMove] = await tx
					.select()
					.from(Block)
					.where(eq(Block.id, input.blockId))
					.limit(1);

				if (!blockToMove) {
					throw new Error("Block not found");
				}

				// 2. Remove from old parent's content array
				// ... implementation for removing from old parent ...

				// 3. Add to new parent's content array
				// ... implementation for adding to new parent ...

				// 4. Update block's parent references
				await tx
					.update(Block)
					.set({
						parent_id: input.newParentId,
						parent_type: input.newParentType,
						updated_at: new Date(),
					})
					.where(eq(Block.id, input.blockId));

				return blockToMove;
			});
		}),
};
