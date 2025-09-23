"use client";

import { getAIExtension } from "@blocknote/xl-ai";
import { useDrawer } from "~/components/ui/drawer";
import { useJournlAgentAwareness } from "../agents/use-journl-agent-awareness";
import { createClientTool } from "../utils/create-client-tool";
import { zManipulateEditorInput } from "./manipulate-editor.schema";

export function useManipulateEditorTool() {
  const { getEditors } = useJournlAgentAwareness();
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
          void chat.addToolResult({
            output: `Editor ${toolCall.input.targetEditor} was not found. Please call the tool again targeting one of the following editors: ${activeEditors}`,
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
          });
          return;
        }

        const aiExtension = getAIExtension(editor);

        let hasScrolledAtLeastOnce = false;
        function handleBlockUpdate(block: string) {
          const blockElement = document.querySelector(`[data-id="${block}"]`);
          if (
            blockElement &&
            !isElementPartiallyInViewport(blockElement) &&
            !hasScrolledAtLeastOnce
          ) {
            blockElement.scrollIntoView({ behavior: "smooth" });
            hasScrolledAtLeastOnce = true;
          }
        }

        const response = await aiExtension.callLLM({
          onBlockUpdate: handleBlockUpdate,
          userPrompt: toolCall.input.editorPrompt,
        });

        const stream = response?.llmResult.streamObjectResult;
        const changes = await stream?.object;

        void chat.addToolResult({
          output: changes
            ? `The following changes were made: ${JSON.stringify(changes)}`
            : "Something went wrong and no changes were made.",
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
        });

        if (changes) {
          closeDrawer();
        }
      } catch (error) {
        void chat.addToolResult({
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
