import { eq, inArray } from "@acme/db";
import {
	Block,
	type BlockType,
	blockPropsSchemas,
	blockTypeSchema,
	Page,
} from "@acme/db/schema";
import { and } from "drizzle-orm";
import { z } from "zod/v4";
import { protectedProcedure } from "../trpc.js";

export const blocksRouter = {
	// Bulk operations for efficient batch processing
	bulkCreate: protectedProcedure
		.input(
			z.object({
				blocks: z.array(
					z.object({
						content: z.array(z.any()).optional(),
						id: z.string().uuid(),
						parentId: z.string().uuid(),
						parentType: z.enum(["page", "journal_entry", "block"]),
						props: z.record(z.string(), z.any()).default({}),
						type: blockTypeSchema,
					}),
				),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return await ctx.db.transaction(async (tx) => {
				const createdBlocks = [];

				for (const blockData of input.blocks) {
					// Validate props based on block type
					const propsSchema = blockPropsSchemas[blockData.type as BlockType];
					const validatedProps = propsSchema.parse(blockData.props);

					const [newBlock] = await tx
						.insert(Block)
						.values({
							children: [],
							content: blockData.content || null,
							created_by: ctx.session.user.id,
							id: blockData.id,
							parent_id: blockData.parentId,
							parent_type: blockData.parentType,
							props: validatedProps,
							type: blockData.type,
						})
						.returning();

					if (newBlock) {
						createdBlocks.push(newBlock);
					}
				}

				return { blocks: createdBlocks, created: createdBlocks.length };
			});
		}),

	bulkDelete: protectedProcedure
		.input(
			z.object({
				blockIds: z.array(z.string().uuid()),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return await ctx.db.transaction(async (tx) => {
				// Collect all child IDs recursively for each block
				const collectChildIds = async (blockId: string): Promise<string[]> => {
					const [block] = await tx
						.select({ children: Block.children })
						.from(Block)
						.where(eq(Block.id, blockId))
						.limit(1);

					if (!block) return [];

					const childIds = (block.children as string[]) || [];
					const allChildIds = [...childIds];

					for (const childId of childIds) {
						const grandChildIds = await collectChildIds(childId);
						allChildIds.push(...grandChildIds);
					}

					return allChildIds;
				};

				let allBlockIdsToDelete: string[] = [];
				for (const blockId of input.blockIds) {
					allBlockIdsToDelete.push(blockId);
					const childIds = await collectChildIds(blockId);
					allBlockIdsToDelete.push(...childIds);
				}

				// Remove duplicates
				allBlockIdsToDelete = [...new Set(allBlockIdsToDelete)];

				// Delete all blocks
				await tx.delete(Block).where(inArray(Block.id, allBlockIdsToDelete));

				return { deleted: allBlockIdsToDelete.length };
			});
		}),

	bulkUpdate: protectedProcedure
		.input(
			z.object({
				blocks: z.array(
					z.object({
						content: z.array(z.any()).optional(),
						id: z.string().uuid(),
						props: z.record(z.string(), z.any()).optional(),
						type: blockTypeSchema.optional(),
					}),
				),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return await ctx.db.transaction(async (tx) => {
				const updatedBlocks = [];

				for (const blockData of input.blocks) {
					const updateData: Partial<Block> = { updated_at: new Date() };

					if (blockData.props !== undefined) {
						// Get current block type to validate props if type not provided
						let blockType: BlockType | undefined = blockData.type as BlockType;
						if (!blockType) {
							const [currentBlock] = await tx
								.select({ type: Block.type })
								.from(Block)
								.where(eq(Block.id, blockData.id))
								.limit(1);
							blockType = currentBlock?.type as BlockType;
						}

						if (blockType) {
							const propsSchema = blockPropsSchemas[blockType];
							updateData.props = propsSchema.parse(blockData.props);
						}
					}

					if (blockData.content !== undefined) {
						updateData.content = blockData.content;
					}

					if (blockData.type !== undefined) {
						updateData.type = blockData.type;
					}

					const [updatedBlock] = await tx
						.update(Block)
						.set(updateData)
						.where(eq(Block.id, blockData.id))
						.returning();

					if (updatedBlock) {
						updatedBlocks.push(updatedBlock);
					}
				}

				return { blocks: updatedBlocks, updated: updatedBlocks.length };
			});
		}),
	// Create block and update parent's content array (Notion-style transaction)
	create: protectedProcedure
		.input(
			z.object({
				content: z.array(z.any()).optional(),
				insertIndex: z.number().min(0).optional(),
				parentId: z.string().uuid(),
				parentType: z.enum(["page", "journal_entry", "block"]),
				props: z.record(z.string(), z.any()).default({}), // InlineContent[]
				type: blockTypeSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Validate props based on block type
			const propsSchema = blockPropsSchemas[input.type as BlockType];
			const validatedProps = propsSchema.parse(input.props);

			return await ctx.db.transaction(async (tx) => {
				// 1. Create the block
				const [newBlock] = await tx
					.insert(Block)
					.values({
						children: [],
						content: input.content || null,
						created_by: ctx.session.user.id,
						parent_id: input.parentId,
						parent_type: input.parentType,
						props: validatedProps,
						type: input.type,
					})
					.returning();

				if (!newBlock) {
					throw new Error("Failed to create block");
				}

				// 2. Update parent's content array
				if (input.parentType === "page") {
					const [page] = await tx
						.select({ children: Page.children })
						.from(Page)
						.where(eq(Page.id, input.parentId))
						.limit(1);

					const currentChildren = (page?.children as string[]) || [];
					const insertAt = input.insertIndex ?? currentChildren.length;
					const newChildren = [...currentChildren];
					newChildren.splice(insertAt, 0, newBlock.id);

					await tx
						.update(Page)
						.set({ children: newChildren })
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
						.select({ children: Block.children })
						.from(Block)
						.where(eq(Block.id, input.parentId))
						.limit(1);

					const currentChildren = (parentBlock?.children as string[]) || [];
					const insertAt = input.insertIndex ?? currentChildren.length;
					const newChildren = [...currentChildren];
					newChildren.splice(insertAt, 0, newBlock.id);

					await tx
						.update(Block)
						.set({ children: newChildren })
						.where(eq(Block.id, input.parentId));
				}

				return newBlock;
			});
		}),

	// Delete block and all its children recursively
	delete: protectedProcedure
		.input(z.object({ blockId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			return await ctx.db.transaction(async (tx) => {
				// 1. Get the block to delete
				const [blockToDelete] = await tx
					.select()
					.from(Block)
					.where(eq(Block.id, input.blockId))
					.limit(1);

				if (!blockToDelete) {
					// Block not found - it may have already been deleted
					// Return success to avoid errors in the UI
					return {
						alreadyDeleted: true,
						deletedBlockId: input.blockId,
						deletedChildrenCount: 0,
					};
				}

				// 2. Recursively collect all child block IDs
				const collectChildIds = async (blockId: string): Promise<string[]> => {
					const [block] = await tx
						.select({ children: Block.children })
						.from(Block)
						.where(eq(Block.id, blockId))
						.limit(1);

					if (!block) return [];

					const childIds = (block.children as string[]) || [];
					const allChildIds = [...childIds];

					// Recursively collect children of children
					for (const childId of childIds) {
						const grandChildIds = await collectChildIds(childId);
						allChildIds.push(...grandChildIds);
					}

					return allChildIds;
				};

				const allChildIds = await collectChildIds(input.blockId);
				const allBlockIdsToDelete = [input.blockId, ...allChildIds];

				// 3. Remove block from parent's children array
				if (blockToDelete.parent_type === "page") {
					const [page] = await tx
						.select({ children: Page.children })
						.from(Page)
						.where(eq(Page.id, blockToDelete.parent_id))
						.limit(1);

					if (page) {
						const currentChildren = (page.children as string[]) || [];
						const newChildren = currentChildren.filter(
							(childId) => childId !== input.blockId,
						);

						await tx
							.update(Page)
							.set({ children: newChildren })
							.where(eq(Page.id, blockToDelete.parent_id));
					}
				} else if (blockToDelete.parent_type === "journal_entry") {
					// Journal entries don't currently have children arrays, but if they did:
					// const [journalEntry] = await tx
					// 	.select({ children: JournalEntry.children })
					// 	.from(JournalEntry)
					// 	.where(eq(JournalEntry.id, blockToDelete.parent_id))
					// 	.limit(1);
					// if (journalEntry) {
					// 	const currentChildren = (journalEntry.children as string[]) || [];
					// 	const newChildren = currentChildren.filter(
					// 		(childId) => childId !== input.blockId
					// 	);
					// 	await tx
					// 		.update(JournalEntry)
					// 		.set({ children: newChildren })
					// 		.where(eq(JournalEntry.id, blockToDelete.parent_id));
					// }
				} else if (blockToDelete.parent_type === "block") {
					const [parentBlock] = await tx
						.select({ children: Block.children })
						.from(Block)
						.where(eq(Block.id, blockToDelete.parent_id))
						.limit(1);

					if (parentBlock) {
						const currentChildren = (parentBlock.children as string[]) || [];
						const newChildren = currentChildren.filter(
							(childId) => childId !== input.blockId,
						);

						await tx
							.update(Block)
							.set({ children: newChildren })
							.where(eq(Block.id, blockToDelete.parent_id));
					}
				}

				// 4. Delete all blocks (parent and all children)
				await tx.delete(Block).where(inArray(Block.id, allBlockIdsToDelete));

				return {
					alreadyDeleted: false,
					deletedBlockId: input.blockId,
					deletedChildrenCount: allChildIds.length,
				};
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
			console.log("🔍 loadPageChunk called with:", input);

			// First, get the parent's content array to determine order
			let parentContent: string[] = [];

			if (input.parentType === "page") {
				const [page] = await ctx.db
					.select({ children: Page.children })
					.from(Page)
					.where(eq(Page.id, input.parentId))
					.limit(1);
				parentContent = (page?.children as string[]) || [];
				console.log("📄 Page children found:", {
					children: parentContent,
					childrenCount: parentContent.length,
					pageId: input.parentId,
				});
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
					.select({ children: Block.children })
					.from(Block)
					.where(eq(Block.id, input.parentId))
					.limit(1);
				parentContent = (parentBlock?.children as string[]) || [];
			}

			// If no content array or empty, return empty result
			if (parentContent.length === 0) {
				console.log("⚠️ No parent content found - returning empty result");
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
					// Start AFTER the cursor (not including it)
					startIndex = cursorIndex + 1;
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

			console.log("✅ Returning page chunk:", {
				blocksCount: sortedBlocks.length,
				hasMore,
				nextCursor,
				startIndex,
				totalParentContent: parentContent.length,
			});

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
				blocks: Block[];
				hasMore: boolean;
				nextCursor: string | null;
			}> => {
				// First, get the parent's content array
				let parentContent: string[] = [];

				if (parentType === "page") {
					const [page] = await ctx.db
						.select({ children: Page.children })
						.from(Page)
						.where(eq(Page.id, parentId))
						.limit(1);
					parentContent = (page?.children as string[]) || [];
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
						.select({ children: Block.children })
						.from(Block)
						.where(eq(Block.id, parentId))
						.limit(1);
					parentContent = (parentBlock?.children as string[]) || [];
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
						const blockContent = (block.children as string[]) || [];
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
								block as Block & {
									children?: Block[];
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

	// Sync entire page blocks from editor (replaces existing blocks)
	syncPageBlocks: protectedProcedure
		.input(
			z.object({
				blocks: z.array(
					z.object({
						children: z.array(z.string().uuid()).default([]),
						content: z.array(z.any()).optional(),
						id: z.string().uuid(),
						props: z.record(z.string(), z.any()).default({}),
						type: blockTypeSchema,
					}),
				),
				pageId: z.string().uuid(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return await ctx.db.transaction(async (tx) => {
				// 1. Get existing blocks for this page
				const [page] = await tx
					.select({ children: Page.children })
					.from(Page)
					.where(
						and(
							eq(Page.id, input.pageId),
							eq(Page.user_id, ctx.session.user.id),
						),
					)
					.limit(1);

				if (!page) {
					throw new Error("Page not found");
				}

				const existingBlockIds = (page.children as string[]) || [];
				const incomingBlockIds = input.blocks.map((b) => b.id);

				// 2. Determine what to create, update, and delete
				const toCreate = input.blocks.filter(
					(b) => !existingBlockIds.includes(b.id),
				);
				const toUpdate = input.blocks.filter((b) =>
					existingBlockIds.includes(b.id),
				);
				const toDelete = existingBlockIds.filter(
					(id) => !incomingBlockIds.includes(id),
				);

				// 3. Delete removed blocks (and their children recursively)
				if (toDelete.length > 0) {
					const collectChildIds = async (
						blockId: string,
					): Promise<string[]> => {
						const [block] = await tx
							.select({ children: Block.children })
							.from(Block)
							.where(eq(Block.id, blockId))
							.limit(1);

						if (!block) return [];

						const childIds = (block.children as string[]) || [];
						const allChildIds = [...childIds];

						for (const childId of childIds) {
							const grandChildIds = await collectChildIds(childId);
							allChildIds.push(...grandChildIds);
						}

						return allChildIds;
					};

					const allBlockIdsToDelete: string[] = [];
					for (const blockId of toDelete) {
						allBlockIdsToDelete.push(blockId);
						const childIds = await collectChildIds(blockId);
						allBlockIdsToDelete.push(...childIds);
					}

					await tx.delete(Block).where(inArray(Block.id, allBlockIdsToDelete));
				}

				// 4. Create new blocks
				if (toCreate.length > 0) {
					const blocksToInsert = toCreate.map((block) => {
						const propsSchema = blockPropsSchemas[block.type as BlockType];
						const validatedProps = propsSchema.parse(block.props);

						return {
							children: block.children,
							content: block.content || null,
							created_by: ctx.session.user.id,
							id: block.id,
							parent_id: input.pageId,
							parent_type: "page" as const,
							props: validatedProps,
							type: block.type,
						};
					});

					await tx.insert(Block).values(blocksToInsert);
				}

				// 5. Update existing blocks
				if (toUpdate.length > 0) {
					for (const block of toUpdate) {
						const propsSchema = blockPropsSchemas[block.type as BlockType];
						const validatedProps = propsSchema.parse(block.props);

						await tx
							.update(Block)
							.set({
								children: block.children,
								content: block.content || null,
								props: validatedProps,
								type: block.type,
								updated_at: new Date(),
							})
							.where(eq(Block.id, block.id));
					}
				}

				// 6. Update page children order
				await tx
					.update(Page)
					.set({ children: incomingBlockIds })
					.where(eq(Page.id, input.pageId));

				return {
					created: toCreate.length,
					deleted: toDelete.length,
					updated: toUpdate.length,
				};
			});
		}),

	// Update block props and content
	update: protectedProcedure
		.input(
			z.object({
				blockId: z.string().uuid(),
				content: z.array(z.any()).optional(),
				props: z.record(z.string(), z.any()).optional(), // InlineContent[]
				type: blockTypeSchema.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const updateData: Partial<Block> = {};

			if (input.props !== undefined) {
				// If type is provided, validate props based on that type
				if (input.type) {
					const propsSchema = blockPropsSchemas[input.type as BlockType];
					updateData.props = propsSchema.parse(input.props);
				} else {
					// If no type provided, get current block type to validate props
					const [currentBlock] = await ctx.db
						.select({ type: Block.type })
						.from(Block)
						.where(eq(Block.id, input.blockId))
						.limit(1);

					if (currentBlock) {
						const propsSchema =
							blockPropsSchemas[currentBlock.type as BlockType];
						updateData.props = propsSchema.parse(input.props);
					} else {
						updateData.props = input.props;
					}
				}
			}

			if (input.content !== undefined) {
				updateData.content = input.content;
			}

			if (input.type !== undefined) {
				updateData.type = input.type;
			}

			const [updatedBlock] = await ctx.db
				.update(Block)
				.set(updateData)
				.where(eq(Block.id, input.blockId))
				.returning();

			if (!updatedBlock) {
				throw new Error("Block not found");
			}

			return updatedBlock;
		}),
};
