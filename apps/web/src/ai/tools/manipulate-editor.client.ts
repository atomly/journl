"use client";

import { getAIExtension } from "@blocknote/xl-ai";
import { useJournlAgentAwareness } from "../agents/use-journl-agent-awareness";
import { createClientTool } from "../utils/create-client-tool";
import { zManipulateEditorInput } from "./manipulate-editor.schema";

export function useManipulateEditorTool() {
  const { getEditors } = useJournlAgentAwareness();
  const tool = createClientTool({
    execute: async (toolCall, chat) => {
      const editor = getEditors().get(toolCall.input.editorId);

      if (!editor) {
        const availableEditors = JSON.stringify(
          Object.fromEntries(getEditors().entries()),
        );
        return await chat.addToolResult({
          output: `Editor ${toolCall.input.editorId} was not found. Please call the tool again with the available editors: ${availableEditors}`,
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
        });
      }

      try {
        const aiExtension = getAIExtension(editor);

        const result = await aiExtension.callLLM({
          onBlockUpdate: (block) => {
            const blockElement = document.querySelector(`[data-id="${block}"]`);
            if (blockElement && !isElementPartiallyInViewport(blockElement)) {
              blockElement.scrollIntoView({ behavior: "smooth" });
            }
          },
          userPrompt: toolCall.input.userPrompt,
        });

        const changes = await result?.llmResult.streamObjectResult?.object;

        await chat.addToolResult({
          output: `The following changes were made to the editor: ${JSON.stringify(
            changes,
          )}`,
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
        });
      } catch (error) {
        await chat.addToolResult({
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
