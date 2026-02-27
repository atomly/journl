"use client";

import { useJournlAgent } from "../../agents/use-journl-agent";
import { createClientTool } from "../../utils/create-client-tool";
import { getAIExtension, getEditor } from "../common/blocknote-utils";
import { zEditorChangesInput } from "../editor-changes/schema";

export function useRejectEditorChangesTool() {
  const { getEditors } = useJournlAgent();

  const tool = createClientTool({
    execute: async (toolCall, chat) => {
      try {
        const editor = getEditor(toolCall.input.targetEditor)(getEditors);
        const aiExtension = getAIExtension(editor);

        const aiMenuState = aiExtension.store.state.aiMenuState;
        if (
          aiMenuState === "closed" ||
          aiMenuState.status !== "user-reviewing"
        ) {
          const state =
            aiMenuState === "closed" ? "closed" : aiMenuState.status;

          void chat.addToolOutput({
            output: `There are no pending suggested changes to reject in editor ${toolCall.input.targetEditor}. Current AI status: ${state}.`,
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
          });
          return;
        }

        aiExtension.rejectChanges();

        void chat.addToolOutput({
          output: "Rejected the suggested editor changes.",
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
        });
      } catch (error) {
        void chat.addToolOutput({
          output: `Error when calling the tool: ${error}`,
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
        });
      }
    },
    inputSchema: zEditorChangesInput,
    name: "rejectEditorChanges",
  });

  return tool;
}
