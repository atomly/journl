"use client";

import { AIExtension } from "@blocknote/xl-ai";
import { useDrawer } from "~/components/ui/drawer";
import { useJournlAgent } from "../../agents/use-journl-agent";
import { createClientTool } from "../../utils/create-client-tool";
import { zManipulateEditorInput } from "./schema";

export function useManipulateEditorTool() {
  const { getEditors, getEditorSelections } = useJournlAgent();
  const { closeDrawer } = useDrawer();
  const tool = createClientTool({
    execute: async (toolCall, chat) => {
      let cleanUpBeforeChange: (() => void) | undefined;

      try {
        const editor = getEditors().get(toolCall.input.targetEditor)?.editor;

        if (!editor) {
          const activeEditors = JSON.stringify(Array.from(getEditors().keys()));
          void chat.addToolOutput({
            output: `Editor ${toolCall.input.targetEditor} was not found. Please call the tool again targeting one of the following editors: ${activeEditors}`,
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
          });
          return;
        }

        const aiExtension = editor.getExtension(AIExtension);

        if (!aiExtension) {
          void chat.addToolOutput({
            output: `Editor ${toolCall.input.targetEditor} does not have the AI extension installed.`,
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
          });
          return;
        }

        closeDrawer();

        cleanUpBeforeChange = editor.onChange((_, { getChanges }) => {
          closeDrawer();

          const [{ block } = {}] = getChanges();
          if (!block) return;

          const blockElement = document.querySelector(
            `[data-id="${block.id}"]`,
          );
          if (blockElement && !isElementPartiallyInViewport(blockElement)) {
            blockElement.scrollIntoView({ behavior: "smooth" });
            cleanUpBeforeChange?.();
          }
        });

        // Open the AI menu if it's closed to let the user accept or reject the changes.
        const blockId = resolveAIMenuBlockId(editor);
        const aiMenuState = aiExtension.store.state.aiMenuState;
        const hasActiveAIMenuAnchor =
          aiMenuState !== "closed" &&
          document.querySelector(
            `[data-node-type="blockContainer"][data-id="${aiMenuState.blockId}"]`,
          );

        if (blockId && !hasActiveAIMenuAnchor) {
          editor.focus();
          editor.setTextCursorPosition(blockId, "end");
          aiExtension.openAIMenuAtBlock(blockId);
        }

        await aiExtension.invokeAI({
          deleteEmptyCursorBlock: false,
          userPrompt: toolCall.input.editorPrompt,
          useSelection: getEditorSelections(editor).length > 0,
        });

        void chat.addToolOutput({
          output:
            "Draft ready in the editor. Please accept or reject the suggested changes.",
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
        });
      } catch (error) {
        void chat.addToolOutput({
          output: `Error when calling the tool: ${error}`,
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
        });
      } finally {
        cleanUpBeforeChange?.();
      }
    },
    inputSchema: zManipulateEditorInput,
    name: "manipulateEditor",
  });
  return tool;
}

/**
 * Checks if an element is in the viewport.
 */
function isElementPartiallyInViewport(element: Element) {
  const rect = element.getBoundingClientRect();
  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth =
    window.innerWidth || document.documentElement.clientWidth;
  return (
    rect.top < viewportHeight &&
    rect.bottom > 0 &&
    rect.left < viewportWidth &&
    rect.right > 0
  );
}

function resolveAIMenuBlockId(editor: {
  focus?: () => void;
  getTextCursorPosition?: () => { block?: { id?: string } };
  getSelection?: () => { blocks?: Array<{ id?: string }> } | undefined;
  setTextCursorPosition?: (
    blockId: string,
    placement?: "start" | "end",
  ) => void;
  document?: Array<{ id?: string }>;
}) {
  const selection = editor.getSelection?.();
  const selectedLastBlock = selection?.blocks?.at(-1)?.id;
  if (selectedLastBlock) {
    return selectedLastBlock;
  }

  const cursorBlockId = editor.getTextCursorPosition?.().block?.id;
  if (cursorBlockId) {
    return cursorBlockId;
  }

  return editor.document?.[0]?.id;
}
