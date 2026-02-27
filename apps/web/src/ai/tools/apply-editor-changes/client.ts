"use client";

import { useJournlAgent } from "../../agents/use-journl-agent";
import { createClientTool } from "../../utils/create-client-tool";
import { resolveEditorAndAIExtension } from "../editor-changes/client-utils";
import { zEditorChangesInput } from "../editor-changes/schema";

export function useApplyEditorChangesTool() {
  const { getEditors } = useJournlAgent();

  const tool = createClientTool({
    execute: async (toolCall, chat) => {
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

        const { aiExtension } = resolved;

        const aiMenuState = aiExtension.store.state.aiMenuState;
        if (
          aiMenuState === "closed" ||
          aiMenuState.status !== "user-reviewing"
        ) {
          const state =
            aiMenuState === "closed" ? "closed" : aiMenuState.status;

          void chat.addToolOutput({
            output: `There are no pending suggested changes to apply in editor ${toolCall.input.targetEditor}. Current AI status: ${state}.`,
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
          });
          return;
        }

        aiExtension.acceptChanges();

        void chat.addToolOutput({
          output: "Applied the suggested editor changes.",
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
    name: "applyEditorChanges",
  });

  return tool;
}
