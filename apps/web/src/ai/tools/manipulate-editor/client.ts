"use client";

import { useDrawer } from "~/components/ui/drawer";
import { useJournlAgent } from "../../agents/use-journl-agent";
import { createClientTool } from "../../utils/create-client-tool";
import { resolveEditorAndAIExtension } from "../editor-changes/client-utils";
import {
  isElementPartiallyInViewport,
  resolveAIMenuBlockId,
} from "./client-utils";
import { zManipulateEditorInput } from "./schema";

export function useManipulateEditorTool() {
  const { getEditors, getEditorSelections } = useJournlAgent();
  const { closeDrawer } = useDrawer();
  const tool = createClientTool({
    execute: async (toolCall, chat) => {
      let cleanUpBeforeChange: (() => void) | undefined;

      try {
        const resolved = resolveEditorAndAIExtension({
          chat,
          getEditors,
          targetEditor: toolCall.input.targetEditor,
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
        });

        if (!resolved) {
          return;
        }

        const { aiExtension, editor } = resolved;

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
