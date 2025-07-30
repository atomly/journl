import { eq, inArray } from "@acme/db";
import type { DbTransaction } from "@acme/db/client";
import {
	Block,
	type BlockType,
	blockPropsSchemas,
	blockTypeSchema,
	Page,
} from "@acme/db/schema";
import { z } from "zod";
import { protectedProcedure } from "../trpc.js";

// ===== SCHEMAS =====
const blockDataSchema = z.object({
	children: z.unknown(),
	content: z.unknown(),
	id: z.string().uuid(),
	props: z.record(z.string(), z.unknown()),
	type: blockTypeSchema,
});

const parentTypeEnum = z.enum(["page", "journal_entry", "block"]);
const blockChangeTypeEnum = z.enum(["insert", "update", "delete"]);

// ===== HELPER FUNCTIONS =====

/**
 * Updates the children array of a parent entity
 */
async function updateParentChildren(
	tx: DbTransaction,
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
	tx: DbTransaction,
	blockId: string,
	collected = new Set<string>(),
): Promise<string[]> {
	if (collected.has(blockId)) {
		return [];
	}
	collected.add(blockId);

	const [block] = await tx
		.select({ children: Block.children })
		.from(Block)
		.where(eq(Block.id, blockId))
		.limit(1);

	if (!block) return [];

	const childIds = (block.children as string[]) || [];
	const allChildIds = [...childIds];

	for (const childId of childIds) {
		if (!collected.has(childId)) {
			const grandChildIds = await collectChildBlockIds(tx, childId, collected);
			allChildIds.push(...grandChildIds);
		}
	}

	return allChildIds;
}

/**
 * Processes and validates block data for database operations
 */
function processBlockData(
	data: {
		type: BlockType;
		id: string;
		props?: Record<string, unknown>;
		content?: unknown;
		children?: unknown;
	},
	userId: string,
	defaultParentId: string,
	defaultParentType: string,
	newParentId?: string,
	newParentType?: string,
) {
	const propsSchema = blockPropsSchemas[data.type];
	const validatedProps = propsSchema.parse(data.props || {});

	// Handle content: store whatever BlockNote sends us
	const content = data.content;

	// Handle children: always an array
	const children = Array.isArray(data.children)
		? data.children
				.map((child) => (typeof child === "string" ? child : child.id))
				.filter(Boolean)
		: [];

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
				parentChildren: z.array(z.string().uuid()),
			}),
		)
		.query(async ({ ctx, input }) => {
			if (input.parentChildren.length === 0) {
				return {
					blocks: [],
					hasMore: false,
					nextCursor: null,
				};
			}

			// Calculate pagination
			let startIndex = 0;
			if (input.cursor) {
				const cursorIndex = input.parentChildren.indexOf(input.cursor);
				if (cursorIndex !== -1) {
					startIndex = cursorIndex + 1; // Start after cursor
				}
			}

			const availableBlockIds = input.parentChildren.slice(startIndex);
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
	 * Processes editor changes in a single atomic transaction.
	 * Handles block insertions, updates, deletions, and parent-child relationships.
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

				// Step 1: Collect all blocks to delete (including nested children)
				const allBlockIdsToDelete = new Set<string>();
				const deleteRequests = input.blockChanges.filter(
					(change) => change.type === "delete",
				);

				for (const change of deleteRequests) {
					allBlockIdsToDelete.add(change.blockId);
					const childIds = await collectChildBlockIds(tx, change.blockId);
					childIds.forEach((id) => allBlockIdsToDelete.add(id));
				}

				// Step 2: Update parent children arrays
				if (input.updateChildren) {
					const filteredParentChildren = input.parentChildren.filter(
						(childId) => !allBlockIdsToDelete.has(childId),
					);

					await updateParentChildren(
						tx,
						input.parentId,
						input.parentType,
						filteredParentChildren,
					);
				}

				// Update block parents that contain deleted children
				const potentialParentBlocks = await tx
					.select({ children: Block.children, id: Block.id })
					.from(Block)
					.where(eq(Block.parent_id, input.parentId));

				for (const parentBlock of potentialParentBlocks) {
					const currentChildren = (parentBlock.children as string[]) || [];
					const updatedChildren = currentChildren.filter(
						(childId) => !allBlockIdsToDelete.has(childId),
					);

					if (updatedChildren.length !== currentChildren.length) {
						await tx
							.update(Block)
							.set({ children: updatedChildren })
							.where(eq(Block.id, parentBlock.id));
					}
				}

				// Step 3: Process insert/update operations
				for (const change of input.blockChanges) {
					if (change.type === "insert" || change.type === "update") {
						const { data, type, newParentId, newParentType } = change;

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
									updated_at: new Date().toISOString(),
								},
								target: Block.id,
							});

						results[type === "insert" ? "created" : "updated"]++;
					}
				}

				// Step 4: Delete all collected blocks
				if (allBlockIdsToDelete.size > 0) {
					const blockIdsArray = Array.from(allBlockIdsToDelete);
					await tx.delete(Block).where(inArray(Block.id, blockIdsArray));
					results.deleted = blockIdsArray.length;
				}

				return results;
			});
		}),
};
