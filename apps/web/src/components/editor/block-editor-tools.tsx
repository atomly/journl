"use client";

import type { BlockPrimitive, schema } from "@acme/blocknote/schema";
import { filterSuggestionItems } from "@blocknote/core/extensions";
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
import { useJournlAgent } from "~/ai/agents/use-journl-agent";
import { useIsMobile } from "~/hooks/use-mobile";

export function BlockEditorFormattingToolbar() {
  const isMobile = useIsMobile();
  const toolbar = (
    <FormattingToolbar>
      <AIToolbarButton />
      <AddBlockSelectionButton />
      {...getFormattingToolbarItems()}
    </FormattingToolbar>
  );

  if (isMobile) {
    return (
      <div className="sticky top-0 z-30 rounded-lg bg-background px-4 pt-2 shadow-sm">
        {toolbar}
      </div>
    );
  }

  return (
    <FormattingToolbarController
      floatingUIOptions={{
        useFloatingOptions: {
          strategy: "fixed",
        },
      }}
      formattingToolbar={() => toolbar}
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
      floatingUIOptions={{
        useFloatingOptions: {
          strategy: "fixed",
        },
      }}
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
  const { rememberSelection, getSelection, forgetSelection } = useJournlAgent();

  // Doesn't render unless a at least one block with inline content is selected.
  const blocks = useSelectedBlocks<
    typeof schema.blockSchema,
    typeof schema.inlineContentSchema,
    typeof schema.styleSchema
  >() as BlockPrimitive[];

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
