import { eq, inArray } from "@acme/db";
import {
	Block,
	type BlockType,
	blockPropsSchemas,
	Page,
} from "@acme/db/schema";
import { z } from "zod/v4";
import { protectedProcedure } from "../trpc.js";

// Define schemas for block data validation
const blockDataSchema = z.object({
	children: z.any(), // Accept any children format from BlockNote
	content: z.any(), // Accept any content format from BlockNote
	id: z.string().uuid(),
	props: z.record(z.string(), z.any()),
	type: z.string(),
});

export const blocksRouter = {
	// Notion-style loadPageChunk - loads blocks in chunks with pagination
	// Simple approach: chunk the flat children array, let client reconstruct hierarchy
	loadPageChunk: protectedProcedure
		.input(
			z.object({
				cursor: z.string().uuid().optional(),
				limit: z.number().min(1).max(100).default(50),
				parentId: z.string().uuid(),
				parentType: z.enum(["page", "journal_entry", "block"]),
			}),
		)
		.query(async ({ ctx, input }) => {
			// First, get the parent's children array to determine order
			let parentContent: string[] = [];

			if (input.parentType === "page") {
				const [page] = await ctx.db
					.select({ children: Page.children })
					.from(Page)
					.where(eq(Page.id, input.parentId))
					.limit(1);
				parentContent = (page?.children as string[]) || [];
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

			// Get available blocks from the starting position
			const availableBlockIds = parentContent.slice(startIndex);

			// Simple chunking: take blocks from flat children array in order
			const selectedBlockIds = availableBlockIds.slice(0, input.limit);
			const hasMore = availableBlockIds.length > input.limit;

			// Next cursor is the last block in current chunk
			const nextCursor =
				hasMore && selectedBlockIds.length > 0
					? selectedBlockIds[selectedBlockIds.length - 1]
					: null;

			// Get all blocks by their IDs
			const allBlocks = await ctx.db
				.select()
				.from(Block)
				.where(inArray(Block.id, selectedBlockIds));

			// Create a map to maintain the order from selectedBlockIds
			const blockMap = new Map(allBlocks.map((block) => [block.id, block]));

			// Return blocks in the order they appear in selectedBlockIds (which follows page.children order)
			const orderedBlocks = selectedBlockIds
				.map((id) => blockMap.get(id))
				.filter((block) => block !== undefined);

			return {
				blocks: orderedBlocks, // Return flat blocks in correct order, let client handle nesting
				hasMore,
				nextCursor,
			};
		}),
	// Process editor changes - handles both block changes and parent children updates in a single transaction
	processEditorChanges: protectedProcedure
		.input(
			z.object({
				blockChanges: z.array(
					z.object({
						blockId: z.string().uuid(),
						data: blockDataSchema,
						// Optional parent info for when blocks move between parents
						newParentId: z.string().uuid().optional(),
						newParentType: z
							.enum(["page", "journal_entry", "block"])
							.optional(),
						type: z.enum(["insert", "update", "delete"]),
					}),
				),
				parentChildren: z.array(z.string().uuid()),
				parentId: z.string().uuid(),
				parentType: z.enum(["page", "journal_entry", "block"]),
				updateChildren: z.boolean().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return await ctx.db.transaction(async (tx) => {
				const results = {
					created: 0,
					deleted: 0,
					updated: 0,
				};

				// 1. Update parent children order based on parentType
				if (input.updateChildren) {
					if (input.parentType === "page") {
						await tx
							.update(Page)
							.set({ children: input.parentChildren })
							.where(eq(Page.id, input.parentId));
					} else if (input.parentType === "block") {
						await tx
							.update(Block)
							.set({ children: input.parentChildren })
							.where(eq(Block.id, input.parentId));
					}
				}

				// 2. Process block changes
				for (const change of input.blockChanges) {
					const { blockId, data, type, newParentId, newParentType } = change;

					if (type === "insert" || type === "update") {
						// Upsert block (insert or update if exists) - works for both insert and update
						const propsSchema = blockPropsSchemas[data.type as BlockType];
						const validatedProps = propsSchema.parse(data.props || {});

						// Handle content: for BlockNote, content can be undefined, null, or an array
						let content = null;
						if (
							data.content &&
							Array.isArray(data.content) &&
							data.content.length > 0
						) {
							content = data.content;
						}

						// Handle children: ensure it's always an array
						const children = Array.isArray(data.children) ? data.children : [];

						// Use new parent info if provided, otherwise use default parent
						const blockParentId = newParentId || input.parentId;
						const blockParentType = newParentType || input.parentType;

						await tx
							.insert(Block)
							.values({
								children,
								content,
								created_by: ctx.session.user.id,
								id: blockId,
								parent_id: blockParentId,
								parent_type: blockParentType,
								props: validatedProps,
								type: data.type,
							})
							.onConflictDoUpdate({
								set: {
									children,
									content,
									parent_id: blockParentId,
									parent_type: blockParentType,
									props: validatedProps,
									type: data.type,
									updated_at: new Date(),
								},
								target: Block.id,
							});

						// Count appropriately for tracking
						if (type === "insert") {
							results.created++;
						} else {
							results.updated++;
						}
					} else if (type === "delete") {
						// Delete block and all its children recursively
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

						const childIds = await collectChildIds(blockId);
						const allBlockIdsToDelete = [blockId, ...childIds];

						await tx
							.delete(Block)
							.where(inArray(Block.id, allBlockIdsToDelete));
						results.deleted += allBlockIdsToDelete.length;
					}
				}

				return results;
			});
		}),
};
