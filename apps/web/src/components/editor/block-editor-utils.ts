"use client";

import type { BlockPrimitive, EditorPrimitive } from "@acme/blocknote/schema";
import type { Block } from "@blocknote/core";
import { AIExtension } from "@blocknote/xl-ai";
import type { BlockTransaction } from "~/trpc";
import type { DefaultMap } from "../../lib/default-map";

export type EditorBlock = BlockPrimitive & {
  previous?: BlockPrimitive;
  next?: BlockPrimitive;
  parent?: BlockPrimitive;
  index: number;
};

export type BlockTransactionMap = DefaultMap<
  Extract<BlockTransaction["type"], `block_${string}`>,
  Map<Block["id"], BlockTransaction["args"]>
>;

export type EdgeTransactionMap = DefaultMap<
  Extract<BlockTransaction["type"], `edge_${string}`>,
  DefaultMap<Block["id"], Map<Block["id"], BlockTransaction["args"]>>
>;

/**
 * Flattens a tree of blocks into a single array of blocks.
 * @param blocks - The blocks to flatten.
 * @param parent - The parent block of the current block list.
 * @returns A flattened array of blocks.
 */
export function getEditorBlocks(
  blocks: BlockPrimitive[],
  parent?: BlockPrimitive,
) {
  const flattened = new Map<BlockPrimitive["id"], EditorBlock>();

  for (const [index, block] of blocks.entries()) {
    const editorBlock: EditorBlock = {
      ...block,
      index,
      next: blocks[index + 1],
      parent,
      previous: blocks[index - 1],
    };

    flattened.set(block.id, editorBlock);

    if (block.children) {
      getEditorBlocks(block.children, block).forEach((editorBlock) => {
        flattened.set(editorBlock.id, editorBlock);
      });
    }
  }

  return flattened;
}

/**
 * Flattens BlockTransactions map into an array of BlockTransaction objects.
 */
export function flattenBlockTransactions(
  blockTransactions: BlockTransactionMap,
): BlockTransaction[] {
  const transactions: BlockTransaction[] = [];

  for (const [type, blockMap] of blockTransactions.entries()) {
    for (const args of blockMap.values()) {
      transactions.push({
        args,
        type,
      } as BlockTransaction);
    }
  }

  return transactions;
}

/**
 * Flattens EdgeTransactions map into an array of BlockTransaction objects.
 */
export function flattenEdgeTransactions(
  edgeTransactions: EdgeTransactionMap,
): BlockTransaction[] {
  const transactions: BlockTransaction[] = [];

  // Removing redundant edge remove/insert pairs
  const removeMap = edgeTransactions.get("edge_remove");
  const insertMap = edgeTransactions.get("edge_insert");
  for (const [fromId, toMap] of removeMap.entries()) {
    for (const toId of toMap.keys()) {
      if (insertMap.get(fromId).has(toId)) {
        insertMap.get(fromId).delete(toId);
        removeMap.get(fromId).delete(toId);
      }
    }
  }

  for (const [type, fromMap] of edgeTransactions.entries()) {
    for (const toMap of fromMap.values()) {
      for (const args of toMap.values()) {
        transactions.push({
          args,
          type,
        } as BlockTransaction);
      }
    }
  }

  return transactions;
}

export function isAgenticEditorChange(editor: EditorPrimitive) {
  const aiExtension = editor.getExtension(AIExtension);
  const state = aiExtension?.store.state.aiMenuState;

  if (!state || typeof state !== "object") return false;

  return state.status === "thinking" || state.status === "ai-writing";
}
