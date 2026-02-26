"use client";

import { AIExtension } from "@blocknote/xl-ai";
import { useJournlAgent } from "../../agents/use-journl-agent";
import { createClientTool } from "../../utils/create-client-tool";
import { zEditorChangesInput } from "../editor-changes/schema";

export function useRejectEditorChangesTool() {
  const { getEditors } = useJournlAgent();

  const tool = createClientTool({
    execute: async (toolCall, chat) => {
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
