"use client";

import { AIExtension } from "@blocknote/xl-ai";
import { useDrawer } from "~/components/ui/drawer";
import { useJournlAgent } from "../agents/use-journl-agent";
import { createClientTool } from "../utils/create-client-tool";
import { zManipulateEditorInput } from "./manipulate-editor.schema";

export function useManipulateEditorTool() {
  const { getEditors } = useJournlAgent();
  const { closeDrawer } = useDrawer();
  const tool = createClientTool({
    execute: async (toolCall, chat) => {
      try {
        const editor = getEditors().get(toolCall.input.targetEditor)?.editor;

        if (!editor) {
          const activeEditors = JSON.stringify(
            Array.from(getEditors().values()).map(
              ({ editor, ...rest }) => rest,
            ),
          );
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

        let didChange = false;

        const cleanUpBeforeChange = editor.onChange((_, { getChanges }) => {
          didChange = true;

          const [{ block } = {}] = getChanges();
          if (!block) return;

          const blockElement = document.querySelector(
            `[data-id="${block.id}"]`,
          );
          if (blockElement && !isElementPartiallyInViewport(blockElement)) {
            blockElement.scrollIntoView({ behavior: "smooth" });
            cleanUpBeforeChange();
          }
        });

        await aiExtension.invokeAI({
          userPrompt: toolCall.input.editorPrompt,
        });

        void chat.addToolOutput({
          output: "Writing into the journal...",
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
        });

        cleanUpBeforeChange();

        if (didChange) {
          closeDrawer();
        }
      } catch (error) {
        void chat.addToolOutput({
          output: `Error when calling the tool: ${error}`,
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
        });
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
