"use client";

import type { BlockPrimitive, schema } from "@acme/blocknote/schema";
import {
  FormattingToolbarExtension,
  filterSuggestionItems,
} from "@blocknote/core/extensions";
import {
  FormattingToolbar,
  FormattingToolbarController,
  getDefaultReactSlashMenuItems,
  getFormattingToolbarItems,
  SuggestionMenuController,
  useBlockNoteEditor,
  useComponentsContext,
  useExtension,
  useSelectedBlocks,
} from "@blocknote/react";
import {
  AIExtension,
  getAISlashMenuItems,
  useAIDictionary,
} from "@blocknote/xl-ai";
import { RiSparkling2Fill } from "react-icons/ri";
import removeMarkdown from "remove-markdown";
import { useJournlAgent } from "~/ai/agents/use-journl-agent";
import { useIsMobile } from "~/hooks/use-mobile";

export function BlockEditorFloatingToolbar() {
  const isMobile = useIsMobile();

  if (isMobile) return null;

  return (
    <FormattingToolbarController
      floatingUIOptions={{
        useFloatingOptions: {
          strategy: "fixed",
        },
      }}
      formattingToolbar={() => (
        <FormattingToolbar>
          <BlockEditorAIButton />
          <BlockEditorSelectionButton />
          {getFormattingToolbarItems()}
        </FormattingToolbar>
      )}
    />
  );
}

export function BlockEditorStickyToolbar() {
  const isMobile = useIsMobile();

  return (
    <div
      className="sticky z-4000 rounded-lg px-6 pt-2 shadow-sm md:hidden md:px-2"
      style={{ top: "var(--app-visual-viewport-offset-top, 0px)" }}
    >
      <FormattingToolbar>
        {isMobile && (
          <>
            <BlockEditorAIButton />
            <BlockEditorSelectionButton />
          </>
        )}
        {getFormattingToolbarItems()}
      </FormattingToolbar>
    </div>
  );
}

function BlockEditorAIButton() {
  const dict = useAIDictionary();
  const Components = useComponentsContext();
  const editor = useBlockNoteEditor();
  const ai = useExtension(AIExtension);
  const formattingToolbar = useExtension(FormattingToolbarExtension);

  if (!Components || !editor.isEditable) {
    return null;
  }

  function handleClick() {
    const selection = editor.getSelection();
    const selectedBlockId = selection?.blocks.at(-1)?.id;
    const cursorBlockId = editor.getTextCursorPosition().block.id;
    const fallbackBlockId = editor.document.at(-1)?.id;
    const blockId = selectedBlockId || cursorBlockId || fallbackBlockId;

    if (!blockId) {
      return;
    }

    editor.focus();
    editor.setTextCursorPosition(blockId, "end");
    ai.openAIMenuAtBlock(blockId);
    formattingToolbar.store.setState(false);
  }

  return (
    <Components.Generic.Toolbar.Button
      className="bn-button"
      label={dict.formatting_toolbar.ai.tooltip}
      mainTooltip={dict.formatting_toolbar.ai.tooltip}
      icon={<RiSparkling2Fill />}
      onClick={handleClick}
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
function BlockEditorSelectionButton() {
  const editor = useBlockNoteEditor();
  const Components = useComponentsContext();
  const { setSelection, getSelection, unsetSelection } = useJournlAgent();

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
      setSelection({
        blockIds: new Set(blocks.map((block) => block.id)),
        blocks,
        editor,
        markdown,
        text: removeMarkdown(markdown).trim(),
      });
    } else {
      unsetSelection(selection);
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
