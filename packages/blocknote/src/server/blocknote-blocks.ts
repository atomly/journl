import type { BlockEdge, BlockNode } from "@acme/db/schema";
import type { PartialBlock } from "@blocknote/core";
import { z } from "zod/v4";

// Simply using `any` types as we aren't really changing the BlockNote schema anywhere.
const zBlockNoteBlockType = z.any();
const zBlockNoteBlockProps = z.any();

/**
 * Builds a hierarchical block structure from flat blocks and edges data
 * Uses linked list approach with BFS traversal
 *
 * @returns The hierarchical block structure.
 */
export function blocknoteBlocks(
  blocks: BlockNode[],
  edges: BlockEdge[],
): [PartialBlock, ...PartialBlock[]] | undefined {
  if (!blocks || blocks.length === 0) {
    return undefined;
  }

  /** Maps block IDs to their corresponding block data. */
  const blockMap = new Map(blocks.map((block) => [block.id, block]));

  /** Tracks sibling relationships between blocks (e.g., `from_id` -> `to_id`). */
  const siblingsMap = new Map<string, string>(
    edges.map((edge) => [edge.from_id, edge.to_id]),
  );

  /** Tracks parent-child relationships between blocks (e.g., `parent_id` -> `child_id`). */
  const childrenMap = new Map<string, Set<string>>();

  // Build parent-child relationships from parent_id
  for (const block of blocks) {
    if (block.parent_id && blockMap.has(block.parent_id)) {
      const children = childrenMap.get(block.parent_id) || new Set();
      if (!children.has(block.id)) {
        children.add(block.id);
        childrenMap.set(block.parent_id, children);
      }
    }
  }

  // Find root blocks (blocks with null parent_id)
  const rootBlocks = blocks.filter((block) => block.parent_id === null);

  if (rootBlocks.length === 0) {
    return undefined;
  }

  /**
   * Orders sibling blocks using the linked list defined by sibling edges.
   */
  function orderSiblings(siblings: Set<string>): string[] {
    const blockIds = Array.from(siblings);

    if (blockIds.length <= 1) {
      return blockIds;
    }

    // Check if any of these blocks are connected by sibling edges
    const hasRelevantEdges = blockIds.some((id) => {
      const sibling = siblingsMap.get(id);
      return sibling && siblings.has(sibling);
    });

    if (!hasRelevantEdges) {
      return blockIds;
    }

    // Find all blocks that are targets (to_id) of sibling edges within this group
    const targetsInGroup = new Set<string>();
    for (const blockId of blockIds) {
      const next = siblingsMap.get(blockId);
      if (next && siblings.has(next)) {
        targetsInGroup.add(next);
      }
    }

    // Find the head: block in this group that is NOT a target of any sibling edge in this group
    const possibleHeads = blockIds.filter((id) => !targetsInGroup.has(id));

    // If there are no possible heads, return the block IDs.
    if (!possibleHeads[0]) {
      return blockIds;
    }

    let head: string | null = null;

    // If we have exactly one non-target, that's our head
    if (possibleHeads.length === 1) {
      head = possibleHeads[0];
    } else if (possibleHeads.length > 1) {
      // Multiple possible heads - pick the first one
      head = possibleHeads[0];
    } else if (blockIds[0]) {
      // This shouldn't happen in a proper linked list, but fallback to first block
      head = blockIds[0];
      console.error("No clear head found (circular?), using first block");
    }

    // If we still don't have a head, return the block IDs.
    if (!head) {
      return blockIds;
    }

    // Traverse the linked list starting from head
    const result: string[] = [];
    const visited = new Set<string>();

    let current: string | undefined = head;
    while (current && siblings.has(current) && !visited.has(current)) {
      visited.add(current);
      result.push(current);
      current = siblingsMap.get(current);
    }

    // Add any remaining blocks that weren't in the linked list
    const remaining = blockIds.filter((id) => !result.includes(id));
    const finalResult = [...result, ...remaining];

    if (remaining.length > 0) {
      console.error(
        `Found ${remaining.length} remaining blocks that weren't in the linked list`,
      );
    }

    return finalResult;
  }

  /**
   * Recursively builds the document tree using a BFS approach.
   */
  function buildDocumentBranch(blockId: string): PartialBlock {
    const block = blockMap.get(blockId);

    if (!block) {
      console.error(`Block not found: ${blockId}`);
      return {};
    }

    const zBlockNoteData = z.object({
      content: z.any(),
      props: zBlockNoteBlockProps,
      type: zBlockNoteBlockType,
    });

    const blockData = zBlockNoteData.parse(block.data);

    // Get children for this block
    const childrenIds = childrenMap.get(blockId) || new Set();

    // Order children using sibling linked lists
    const orderedChildrenIds = orderSiblings(childrenIds);

    // Recursively build children (BFS)
    const children = orderedChildrenIds.map((childId) =>
      buildDocumentBranch(childId),
    );

    // Convert database block to PartialBlock format
    const partialBlock: PartialBlock = {
      children: children,
      content: blockData?.content || undefined,
      id: block.id,
      props: blockData?.props || {},
      type: blockData?.type || "paragraph",
    };

    partialBlock.content;

    return partialBlock;
  }

  // Order root blocks using sibling linked lists
  const rootBlockIds = new Set(rootBlocks.map((block) => block.id));
  const orderedRootIds = orderSiblings(rootBlockIds);

  // Build the tree starting from ordered root blocks
  const [root, ...rest] = orderedRootIds.map((rootId) =>
    buildDocumentBranch(rootId),
  );

  // BlockNote requires at least one block
  if (!root) {
    return undefined;
  }

  return [root, ...rest];
}
