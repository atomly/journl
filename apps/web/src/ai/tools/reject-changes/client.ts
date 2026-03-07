"use client";

import { useJournlAgent } from "../../../hooks/use-journl-agent";
import { createClientTool } from "../../utils/create-client-tool";
import { zEditorChangesInput } from "../common/blocknote-schema";
import { getAIExtension, getEditor } from "../common/blocknote-utils";

export function useRejectChangesTool() {
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
            output: {
              message: "There are no pending suggested changes to reject.",
              state,
            },
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
          });
          return;
        }

        aiExtension.rejectChanges();

        void chat.addToolOutput({
          output: {
            message: "Rejected the suggested editor changes.",
          },
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
        });
      } catch (error) {
        void chat.addToolOutput({
          output: {
            error,
            message: `Error when calling the tool: ${error}`,
          },
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
        });
      }
    },
    inputSchema: zEditorChangesInput,
    name: "rejectChanges",
  });

  return tool;
}
