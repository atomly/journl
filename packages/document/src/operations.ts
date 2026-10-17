import { type BlockData, type DocumentBlock, parseBlock } from "./schema";
import { documentRows } from "./storage";

export type DocumentOperation =
  | {
      type: "insert";
      block: DocumentBlock;
      parentId: string | null;
      afterId: string | null;
    }
  | { type: "update"; id: string; data: BlockData }
  | { type: "remove"; id: string }
  | {
      type: "move";
      id: string;
      parentId: string | null;
      afterId: string | null;
    };

/** Immutable headless edits; all operations succeed together or leave input intact. */
export function applyDocumentOperations(
  input: readonly DocumentBlock[],
  operations: readonly DocumentOperation[],
): DocumentBlock[] {
  const blocks = input.map(parseBlock);
  documentRows(blocks);
  function locate(
    id: string,
    items = blocks,
  ): { block: DocumentBlock; siblings: DocumentBlock[]; index: number } {
    for (const [index, block] of items.entries()) {
      if (block.id === id) return { block, index, siblings: items };
      if (block.children?.length) {
        const found = find(id, block.children);
        if (found) return found;
      }
    }
    throw new Error(`Block not found: ${id}`);
  }
  function find(
    id: string,
    items: DocumentBlock[],
  ): ReturnType<typeof locate> | undefined {
    for (const [index, block] of items.entries()) {
      if (block.id === id) return { block, index, siblings: items };
      const child = find(id, block.children ?? []);
      if (child) return child;
    }
    return undefined;
  }
  for (const operation of operations) {
    if (operation.type === "remove") {
      const target = locate(operation.id);
      target.siblings.splice(target.index, 1);
      continue;
    }
    if (operation.type === "update") {
      const target = locate(operation.id);
      target.siblings[target.index] = parseBlock({
        ...operation.data,
        children: target.block.children,
        id: operation.id,
      });
      continue;
    }
    let block: DocumentBlock;
    if (operation.type === "move") {
      const target = locate(operation.id);
      // Reject self/descendant moves before changing the tree.
      if (
        operation.parentId === target.block.id ||
        (operation.parentId &&
          find(operation.parentId, target.block.children ?? []))
      )
        throw new Error("Cannot move a block into itself");
      if (operation.afterId === operation.id)
        throw new Error("Cannot position a block after itself");
      block = target.block;
      target.siblings.splice(target.index, 1);
    } else block = parseBlock(operation.block);
    let siblings = blocks;
    if (operation.parentId !== null) {
      const parent = locate(operation.parentId).block;
      parent.children ??= [];
      siblings = parent.children;
    }
    const index =
      operation.afterId === null
        ? 0
        : siblings.findIndex((item) => item.id === operation.afterId) + 1;
    if (operation.afterId !== null && index === 0)
      throw new Error("Predecessor is not in the destination sibling group");
    siblings.splice(index, 0, block);
  }
  documentRows(blocks); // Reject duplicate identities, including nested insertions.
  return blocks;
}

/** Copies get fresh identities; authored reference targets retain their meaning. */
export function duplicateBlock(
  block: DocumentBlock,
  createId: () => string,
): DocumentBlock {
  return parseBlock({
    ...structuredClone(block),
    children: block.children?.map((child) => duplicateBlock(child, createId)),
    id: createId(),
  });
}
