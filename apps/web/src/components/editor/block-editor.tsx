"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/xl-ai/style.css";
import type { BlockTransaction } from "@acme/api";
import type { BlockPrimitive, EditorPrimitive } from "@acme/blocknote/schema";
import type { Block, PartialBlock } from "@blocknote/core";
// import { BlockNoteView } from "@blocknote/mantine";
import { BlockNoteView } from "@blocknote/shadcn";
import { AIExtension, AIMenuController } from "@blocknote/xl-ai";
import { useTheme } from "next-themes";
import { type ComponentProps, useEffect, useRef } from "react";
import { useJournlAgent } from "~/ai/agents/use-journl-agent";
import { env } from "~/env";
import { DefaultMap } from "../../lib/default-map";

// import "@blocknote/shadcn/style.css";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Form } from "../ui/form";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Skeleton } from "../ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Toggle } from "../ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

type EditorPrimitiveOnChangeParams = Parameters<
  Parameters<EditorPrimitive["onChange"]>[0]
>;

type EditorBlock = BlockPrimitive & {
  previous?: BlockPrimitive;
  next?: BlockPrimitive;
  parent?: BlockPrimitive;
  index: number;
};

type BlockChange = {
  type: "upsert" | "delete" | "dentation" | "parent";
  block: EditorBlock;
  oldBlock: EditorBlock | undefined;
};

type BlockTransactionMap = DefaultMap<
  Extract<BlockTransaction["type"], `block_${string}`>,
  Map<Block["id"], BlockTransaction["args"]>
>;

type EdgeTransactionMap = DefaultMap<
  Extract<BlockTransaction["type"], `edge_${string}`>,
  DefaultMap<Block["id"], Map<Block["id"], BlockTransaction["args"]>>
>;

type BlockEditorProps = Omit<
  ComponentProps<typeof BlockNoteView>,
  "editor" | "theme" | "onChange" | "shadCNComponents"
> & {
  /**
   * The editor to use.
   */
  editor: EditorPrimitive;
  /**
   * The initial blocks to render in the editor.
   * @note The initial blocks must be a non-empty array.
   */
  initialBlocks?: [PartialBlock, ...PartialBlock[]] | undefined;
  /**
   * The function to call when the editor changes.
   */
  onChange?: (transactions: BlockTransaction[]) => void;
  /**
   * Whether to enable debugging.
   */
  debug?: boolean;
};

export function BlockEditor({
  editor,
  initialBlocks,
  onChange,
  children,
  debug = env.NODE_ENV === "development",
  ...rest
}: BlockEditorProps) {
  const { theme, systemTheme } = useTheme();
  const previousEditorRef = useRef<typeof editor.document>(editor.document);
  const { forgetEditorSelections, getSelections, forgetSelection } =
    useJournlAgent();

  // Remove block selections when the editor is unmounted.
  useEffect(() => {
    return () => {
      forgetEditorSelections(editor);
    };
  }, [forgetEditorSelections, editor]);

  /**
   * Change handler for the editor.
   *
   * @privateRemarks
   *
   * The biggest challenge is the computation of the edges rather than the blocks.
   *
   * An intuitive approach is to compute the edges for the previous state and the current state and then compute the diff.
   * For example, a brute force approach would be to loop over all blocks and detect if their adjacent blocks are different.
   * If they are we need to remove the previous edge and insert the new edge.
   * However we can take this a step further and reduce the amount of blocks we need to check by keeping track of the affected blocks while handling the block changes.
   * After we are done handling block changes we can loop over the affected blocks and compare the previous and current state of the edges.
   * If the edges are different we need to remove the previous ones and (if it's not a deleted block) insert the new ones.
   *
   * 1. Deletes:
   * - We must create `block_remove` transactions for all deleted blocks (we get these from BlockNote).
   *   - The backend will handle `edge_remove` transactions for removed blocks.
   * - We need to compute `edge_insert` transactions for all edges that need to be reconnected.
   *   - To do this, we need to detect the siblings of the previous and next block of the deleted block that are not being deleted.
   *  - For example, it's not necessarily the siblings right next to the deleted block because multiple adjacent blocks can be deleted.
   *
   * 2. Inserts:
   * - We must create `block_upsert` transactions for all inserted blocks (we get these from BlockNote).
   * - We need to compute `edge_remove` transactions for the previous edges of the adjacent blocks.
   *   - Remember that we can insert multiple adjacent blocks at once, so we need to check the previous state of the adjacent blocks.
   *   - We will check the previous siblings of the previous and next block of the inserted block and delete the edges between them.
   * - We need to compute `edge_insert` transactions for the next edges of the adjacent blocks.
   *   - We will connect the inserted blocks to their adjacent blocks.
   *
   * 3. Moves:
   * - We must create `block_upsert` transactions for all moved blocks (we need to detect these manually).
   *   - A block is considered moved if its parent or position has changed (a changed position means at least one of the adjacent blocks are different).
   * - Moves are more complex than inserts and deletes because we need to compute edges for the blocks that moved and the blocks that are adjacent to the moved blocks (assuming they didn't move).
   */
  function handleEditorChange(currentEditor: EditorPrimitiveOnChangeParams[0]) {
    if (!onChange || isAgenticEditorChange(currentEditor)) return;

    const oldBlocks = getEditorBlocks(previousEditorRef.current);
    const currentBlocks = getEditorBlocks(currentEditor.document);
    const deletedBlockIds = new Set(oldBlocks.keys());

    const blockChanges: BlockChange[] = [];

    for (const currentBlock of currentBlocks.values()) {
      const oldBlock = oldBlocks.get(currentBlock.id);

      // It's an insert if the block doesn't exist in the previous state or if the previous state is empty.
      const isInsert = !oldBlock || oldBlocks.size <= 1;

      // It's an update if the block type, props, or content has changed.
      const isUpdate =
        currentBlock.type !== oldBlock?.type ||
        JSON.stringify(currentBlock.props) !==
          JSON.stringify(oldBlock?.props) ||
        JSON.stringify(currentBlock.content) !==
          JSON.stringify(oldBlock?.content);

      deletedBlockIds.delete(currentBlock.id);

      if (isInsert || isUpdate) {
        blockChanges.push({
          block: currentBlock,
          oldBlock,
          type: "upsert",
        });
      }
    }

    for (const deletedBlockId of deletedBlockIds) {
      const deletedBlock = oldBlocks.get(deletedBlockId);

      if (deletedBlock) {
        blockChanges.push({
          block: deletedBlock,
          oldBlock: undefined,
          type: "delete",
        });
      }
    }

    // We need to manually detect moves because BlockNote doesn't provide a way to do this.
    for (const block of currentBlocks.values()) {
      const oldBlock = oldBlocks.get(block.id);

      // We skip insertions.
      if (!oldBlock) continue;

      const isParentDifferent = oldBlock.parent?.id !== block.parent?.id;
      const isPositionDifferent =
        oldBlock.next?.id !== block.next?.id ||
        oldBlock.previous?.id !== block.previous?.id;

      if (isParentDifferent || isPositionDifferent) {
        blockChanges.push({
          block,
          oldBlock,
          type: isParentDifferent ? "parent" : "dentation",
        });
      }
    }

    const blockTransactions: BlockTransactionMap = new DefaultMap(
      () => new Map(),
    );

    const edgeTransactions: EdgeTransactionMap = new DefaultMap(
      () => new DefaultMap(() => new Map()),
    );

    for (const { block, oldBlock, type } of blockChanges) {
      if (type === "delete") {
        blockTransactions.get("block_remove").set(block.id, {
          id: block.id,
        });
      } else if (type === "upsert" || type === "parent") {
        blockTransactions.get("block_upsert").set(block.id, {
          data: {
            content: block.content,
            props: block.props,
            type: block.type,
          },
          id: block.id,
          parent_id: block.parent?.id ?? null,
        });
      }

      const isPreviousEdgeDifferent =
        oldBlock?.previous?.id !== block.previous?.id;
      const isNextEdgeDifferent = oldBlock?.next?.id !== block.next?.id;

      if (isPreviousEdgeDifferent) {
        if (oldBlock?.previous) {
          edgeTransactions
            .get("edge_remove")
            .get(oldBlock.previous.id)
            .set(oldBlock.id, {
              from_id: oldBlock.previous.id,
              to_id: oldBlock.id,
            });
        }
        if (type !== "delete" && block.previous) {
          edgeTransactions
            .get("edge_insert")
            .get(block.previous.id)
            .set(block.id, {
              from_id: block.previous.id,
              to_id: block.id,
            });
        }
      }

      if (isNextEdgeDifferent) {
        if (oldBlock?.next) {
          edgeTransactions
            .get("edge_remove")
            .get(oldBlock.id)
            .set(oldBlock.next.id, {
              from_id: oldBlock.id,
              to_id: oldBlock.next.id,
            });
        }
        if (type !== "delete" && block.next) {
          edgeTransactions.get("edge_insert").get(block.id).set(block.next.id, {
            from_id: block.id,
            to_id: block.next.id,
          });
        }
      }
    }

    previousEditorRef.current = currentEditor.document;

    const transactions = [
      ...flattenBlockTransactions(blockTransactions),
      ...flattenEdgeTransactions(edgeTransactions),
    ];

    // Leaving this here for debugging purposes because this logic is the wild west.
    if (debug) {
      console.debug("[BlockEditor] transactions 👀", {
        transactions: transactions.map((t) =>
          t.type === "block_remove" || t.type === "block_upsert"
            ? {
                ...t,
                element: document.querySelector(`[data-id="${t.args.id}"]`),
              }
            : {
                ...t,
                from_element: document.querySelector(
                  `[data-id="${t.args.from_id}"]`,
                ),
                to_element: document.querySelector(
                  `[data-id="${t.args.to_id}"]`,
                ),
              },
        ),
      });
    }

    // Removing chat selections that include deleted blocks.
    for (const selection of getSelections()) {
      if (currentEditor !== selection.editor) continue;
      const isDeleted = Array.from(selection.blockIds).some((b) =>
        deletedBlockIds.has(b),
      );
      if (isDeleted) {
        forgetSelection(selection);
      }
    }

    onChange(transactions);
  }

  const resolvedTheme = theme === "system" ? systemTheme : theme;

  return (
    <BlockNoteView
      {...rest}
      editor={editor}
      theme={resolvedTheme as "light" | "dark"}
      onChange={handleEditorChange}
      shadCNComponents={{
        // Pass modified ShadCN components from your project here.
        // Otherwise, the default ShadCN components will be used.
        Avatar: {
          Avatar,
          AvatarFallback,
          AvatarImage,
        },
        Badge: {
          Badge: Badge,
        },
        Button: {
          Button: Button,
        },
        Card: {
          Card: Card,
          CardContent: CardContent,
        },
        DropdownMenu: {
          DropdownMenu,
          DropdownMenuCheckboxItem,
          DropdownMenuContent,
          DropdownMenuItem,
          DropdownMenuLabel,
          DropdownMenuSeparator,
          DropdownMenuSub,
          DropdownMenuSubContent,
          DropdownMenuSubTrigger,
          DropdownMenuTrigger,
        },
        Form: {
          Form,
        },
        Input: {
          Input: Input,
        },
        Label: {
          Label: Label,
        },
        Popover: {
          Popover: Popover,
          PopoverContent: PopoverContent,
          PopoverTrigger: PopoverTrigger,
        },
        Select: {
          Select: Select,
          SelectContent: SelectContent,
          SelectItem: SelectItem,
          SelectTrigger: SelectTrigger,
          SelectValue: SelectValue,
        },
        Skeleton: {
          Skeleton: Skeleton,
        },
        Tabs: {
          Tabs: Tabs,
          TabsContent: TabsContent,
          TabsList: TabsList,
          TabsTrigger: TabsTrigger,
        },
        Toggle: {
          Toggle: Toggle,
        },
        Tooltip: {
          Tooltip,
          TooltipContent,
          TooltipProvider,
          TooltipTrigger,
        },
      }}
    >
      <AIMenuController />
      {children}
    </BlockNoteView>
  );
}

/**
 * Flattens a tree of blocks into a single array of blocks.
 * @param blocks - The blocks to flatten.
 * @param parent - The parent block of the current block list.
 * @returns A flattened array of blocks.
 */
function getEditorBlocks(blocks: BlockPrimitive[], parent?: BlockPrimitive) {
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

function isAgenticEditorChange(editor: EditorPrimitive) {
  const aiExtension = editor.getExtension(AIExtension);
  const state = aiExtension?.store.state.aiMenuState;

  if (!state || typeof state !== "object") return false;

  return state.status === "thinking" || state.status === "ai-writing";
}

/**
 * Flattens BlockTransactions map into an array of BlockTransaction objects.
 */
function flattenBlockTransactions(
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
function flattenEdgeTransactions(
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
