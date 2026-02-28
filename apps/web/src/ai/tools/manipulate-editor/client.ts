"use client";

import { useDrawer } from "~/components/ui/drawer";
import { useJournlAgent } from "../../agents/use-journl-agent";
import { createClientTool } from "../../utils/create-client-tool";
import {
  followJournlAgent,
  getAIExtension,
  getEditor,
  openAIMenu,
} from "../common/blocknote-utils";
import { zManipulateEditorInput } from "./schema";

export function useManipulateEditorTool() {
  const { getEditors, getEditorSelections } = useJournlAgent();
  const { closeDrawer } = useDrawer();
  const tool = createClientTool({
    execute: async (toolCall, chat) => {
      let cleanUpBeforeChange: CallableFunction | undefined;

      try {
        const editor = getEditor(toolCall.input.targetEditor)(getEditors);
        const aiExtension = getAIExtension(editor);

        closeDrawer();

        cleanUpBeforeChange = followJournlAgent(editor, {
          onEditorChange: () => {
            closeDrawer();
          },
        });

        openAIMenu(editor, aiExtension);

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
