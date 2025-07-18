import { eq, inArray } from "@acme/db";
import {
	Block,
	type BlockType,
	blockPropsSchemas,
	Page,
} from "@acme/db/schema";
import { z } from "zod/v4";
import { protectedProcedure } from "../trpc.js";

// ===== SCHEMAS =====
const blockDataSchema = z.object({
	children: z.any(),
	content: z.any(),
	id: z.string().uuid(),
	props: z.record(z.string(), z.any()),
	type: z.string(),
});

const parentTypeEnum = z.enum(["page", "journal_entry", "block"]);
const blockChangeTypeEnum = z.enum(["insert", "update", "delete"]);

// ===== HELPER FUNCTIONS =====

/**
 * Fetches the children array from a parent entity (page, journal_entry, or block)
 */
async function getParentChildren(
	db: any,
	parentId: string,
	parentType: "page" | "journal_entry" | "block",
): Promise<string[]> {
	switch (parentType) {
		case "page": {
			const [page] = await db
				.select({ children: Page.children })
				.from(Page)
				.where(eq(Page.id, parentId))
				.limit(1);
			return (page?.children as string[]) || [];
		}
		case "block": {
			const [block] = await db
				.select({ children: Block.children })
				.from(Block)
				.where(eq(Block.id, parentId))
				.limit(1);
			return (block?.children as string[]) || [];
		}
		case "journal_entry":
			// TODO: Implement when journal_entry table is available
			return [];
		default:
			return [];
	}
}

/**
 * Updates the children array of a parent entity
 */
async function updateParentChildren(
	tx: any,
	parentId: string,
	parentType: "page" | "journal_entry" | "block",
	children: string[],
): Promise<void> {
	switch (parentType) {
		case "page":
			await tx.update(Page).set({ children }).where(eq(Page.id, parentId));
			break;
		case "block":
			await tx.update(Block).set({ children }).where(eq(Block.id, parentId));
			break;
		case "journal_entry":
			// TODO: Implement when journal_entry table is available
			break;
	}
}

/**
 * Recursively collects all child block IDs for deletion
 */
async function collectChildBlockIds(
	tx: any,
	blockId: string,
	collected = new Set<string>(),
): Promise<string[]> {
	// Prevent infinite recursion
	if (collected.has(blockId)) {
		return [];
	}
	collected.add(blockId);

	// Get block's children
	const [block] = await tx
		.select({ children: Block.children })
		.from(Block)
		.where(eq(Block.id, blockId))
		.limit(1);

	if (!block) return [];

	const childIds = (block.children as string[]) || [];
	const allChildIds = [...childIds];

	// Recursively collect grandchildren
	for (const childId of childIds) {
		if (!collected.has(childId)) {
			const grandChildIds = await collectChildBlockIds(tx, childId, collected);
			allChildIds.push(...grandChildIds);
		}
	}

	return allChildIds;
}

/**
 * Processes block data for upsert operations
 */
function processBlockData(
	data: any,
	userId: string,
	defaultParentId: string,
	defaultParentType: string,
	newParentId?: string,
	newParentType?: string,
) {
	const propsSchema = blockPropsSchemas[data.type as BlockType];
	const validatedProps = propsSchema.parse(data.props || {});

	// Handle content: null if empty, otherwise keep the array
	const content =
		data.content && Array.isArray(data.content) && data.content.length > 0
			? data.content
			: null;

	// Handle children: always an array
	const children = Array.isArray(data.children) ? data.children : [];

	// Use new parent info if provided, otherwise use defaults
	const parentId = newParentId || defaultParentId;
	const parentType = newParentType || defaultParentType;

	return {
		children,
		content,
		created_by: userId,
		id: data.id,
		parent_id: parentId,
		parent_type: parentType,
		props: validatedProps,
		type: data.type,
	};
}

// ===== ROUTER =====
export const blocksRouter = {
	/**
	 * Loads blocks in chunks with pagination (Notion-style)
	 */
	loadPageChunk: protectedProcedure
		.input(
			z.object({
				cursor: z.string().uuid().optional(),
				limit: z.number().min(1).max(100).default(50),
				parentId: z.string().uuid(),
				parentType: parentTypeEnum,
			}),
		)
		.query(async ({ ctx, input }) => {
			// Get parent's children array
			const parentChildren = await getParentChildren(
				ctx.db,
				input.parentId,
				input.parentType,
			);

			if (parentChildren.length === 0) {
				return {
					blocks: [],
					hasMore: false,
					nextCursor: null,
				};
			}

			// Calculate pagination
			let startIndex = 0;
			if (input.cursor) {
				const cursorIndex = parentChildren.indexOf(input.cursor);
				if (cursorIndex !== -1) {
					startIndex = cursorIndex + 1; // Start after cursor
				}
			}

			const availableBlockIds = parentChildren.slice(startIndex);
			const selectedBlockIds = availableBlockIds.slice(0, input.limit);
			const hasMore = availableBlockIds.length > input.limit;
			const nextCursor =
				hasMore && selectedBlockIds.length > 0
					? selectedBlockIds[selectedBlockIds.length - 1]
					: null;

			// Fetch blocks and maintain order
			const blocks = await ctx.db
				.select()
				.from(Block)
				.where(inArray(Block.id, selectedBlockIds));

			const blockMap = new Map(blocks.map((block) => [block.id, block]));
			const orderedBlocks = selectedBlockIds
				.map((id) => blockMap.get(id))
				.filter(Boolean);

			return {
				blocks: orderedBlocks,
				hasMore,
				nextCursor,
			};
		}),

	/**
	 * Processes all editor changes in a single transaction
	 */
	processEditorChanges: protectedProcedure
		.input(
			z.object({
				blockChanges: z.array(
					z.object({
						blockId: z.string().uuid(),
						data: blockDataSchema,
						newParentId: z.string().uuid().optional(),
						newParentType: parentTypeEnum.optional(),
						type: blockChangeTypeEnum,
					}),
				),
				parentChildren: z.array(z.string().uuid()),
				parentId: z.string().uuid(),
				parentType: parentTypeEnum,
				updateChildren: z.boolean().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return await ctx.db.transaction(async (tx) => {
				const results = { created: 0, deleted: 0, updated: 0 };

				// Update parent children order if requested
				if (input.updateChildren) {
					await updateParentChildren(
						tx,
						input.parentId,
						input.parentType,
						input.parentChildren,
					);
				}

				// Process each block change
				for (const change of input.blockChanges) {
					const { blockId, data, type, newParentId, newParentType } = change;

					switch (type) {
						case "insert":
						case "update": {
							const blockData = processBlockData(
								data,
								ctx.session.user.id,
								input.parentId,
								input.parentType,
								newParentId,
								newParentType,
							);

							await tx
								.insert(Block)
								.values(blockData)
								.onConflictDoUpdate({
									set: {
										...blockData,
										updated_at: new Date(),
									},
									target: Block.id,
								});

							results[type === "insert" ? "created" : "updated"]++;
							break;
						}

						case "delete": {
							const childIds = await collectChildBlockIds(tx, blockId);
							const allBlockIds = Array.from(new Set([blockId, ...childIds]));

							await tx.delete(Block).where(inArray(Block.id, allBlockIds));
							results.deleted += allBlockIds.length;
							break;
						}
					}
				}

				return results;
			});
		}),
};
