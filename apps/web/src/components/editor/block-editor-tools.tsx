"use client";

import type { BlockPrimitive, schema } from "@acme/blocknote/schema";
import { filterSuggestionItems } from "@blocknote/core";
import {
  FormattingToolbar,
  FormattingToolbarController,
  getDefaultReactSlashMenuItems,
  getFormattingToolbarItems,
  SuggestionMenuController,
  useBlockNoteEditor,
  useComponentsContext,
  useSelectedBlocks,
} from "@blocknote/react";
import { AIToolbarButton, getAISlashMenuItems } from "@blocknote/xl-ai";
import removeMarkdown from "remove-markdown";
import { useJournlAgentAwareness } from "~/ai/agents/use-journl-agent-awareness";

/**
 * The formatting toolbar with the AI option added.
 *
 * @returns The formatting toolbar.
 */
export function BlockEditorFormattingToolbar() {
  return (
    <FormattingToolbarController
      formattingToolbar={() => (
        <FormattingToolbar>
          <AIToolbarButton />
          <AddBlockSelectionButton />
          {...getFormattingToolbarItems()}
        </FormattingToolbar>
      )}
    />
  );
}

/**
 * The slash menu with the AI option added.
 *
 * @param props - The props for the suggestion menu.
 * @returns The suggestion menu.
 */
export function BlockEditorSlashMenu() {
  const editor = useBlockNoteEditor();
  return (
    <SuggestionMenuController
      triggerCharacter="/"
      getItems={async (query) =>
        filterSuggestionItems(
          [
            ...getAISlashMenuItems(editor),
            ...getDefaultReactSlashMenuItems(editor),
          ],
          query,
        )
      }
    />
  );
}

/**
 * Button to add a block selection.
 */
function AddBlockSelectionButton() {
  const editor = useBlockNoteEditor();
  const Components = useComponentsContext();
  const { rememberSelection, getSelection, forgetSelection } =
    useJournlAgentAwareness();

  // Doesn't render unless a at least one block with inline content is selected.
  const blocks = useSelectedBlocks<
    typeof schema.blockSchema,
    typeof schema.inlineContentSchema,
    typeof schema.styleSchema
  >();

  if (
    !Components ||
    blocks.filter((block) => block.content !== undefined).length === 0
  ) {
    return null;
  }

  const selection = getSelection({
    blockIds: new Set(blocks.map((block) => block.id)),
    editor,
  });

  function onClick() {
    if (!selection) {
      const markdown = selectionMarkdown(blocks);
      rememberSelection({
        blockIds: new Set(blocks.map((block) => block.id)),
        blocks,
        editor,
        markdown,
        text: removeMarkdown(markdown).trim(),
      });
    } else {
      forgetSelection(selection);
    }
  }

  const text = selection ? "Remove from Chat" : "Add to Chat";

  return (
    <Components.FormattingToolbar.Button
      mainTooltip={text}
      onClick={onClick}
      isSelected={Boolean(selection)}
      className="shrink-0"
    >
      {text}
    </Components.FormattingToolbar.Button>
  );
}

function selectionMarkdown(blocks: BlockPrimitive[]) {
  const markdown: string[] = [];

  for (const block of blocks) {
    if (!Array.isArray(block.content)) continue;
    const blockMarkdown = block.content
      .filter((c) => "text" in c)
      .map((c) => c.text)
      .join("\n");
    markdown.push(blockMarkdown);
  }

  return markdown.join("\n");
}
