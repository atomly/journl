"use client";

import { stripOpenAICitationTokens } from "~/ai/utils/openai-utils";
import type { BlockNoteRequest } from "~/app/api/ai/blocknote/route";
import { useDrawer } from "~/components/ui/drawer";
import { env } from "~/env";
import { useJournlAgent } from "../../../hooks/use-journl-agent";
import { createClientTool } from "../../utils/create-client-tool";
import {
  followJournlAgent,
  getAIExtension,
  getEditor,
  openAIMenu,
} from "../common/blocknote-utils";
import { zWriteInput } from "./schema";

export function useWriteTool() {
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

        const selectionCount = getEditorSelections(editor).length;

        await aiExtension.invokeAI({
          chatRequestOptions: {
            body: {
              reasoningEffort: toolCall.input.reasoningEffort ?? "low",
            } satisfies Pick<BlockNoteRequest, "reasoningEffort">,
          },
          deleteEmptyCursorBlock: false,
          userPrompt: stripOpenAICitationTokens(toolCall.input.agentPrompt),
          useSelection: selectionCount > 0,
        });

        const { aiMenuState } = aiExtension.store.state;

        if (env.NODE_ENV === "development") {
          console.debug("[aiMenuState]", {
            aiMenuState,
          });
        }

        if (aiMenuState === "closed") {
          void chat.addToolOutput({
            output: {
              message:
                "Finished without a reviewable draft. Suggest retry with a clearer editing instruction.",
              status: "no-draft",
            },
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
          });
          return;
        }

        if (aiMenuState.status === "error") {
          void chat.addToolOutput({
            output: {
              message: `Failed before producing a complete draft: ${toErrorMessage(aiMenuState.error)}`,
              status: "error",
            },
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
          });
          return;
        }

        if (aiMenuState.status !== "user-reviewing") {
          void chat.addToolOutput({
            output: {
              message: `Finished with unexpected state \`${aiMenuState.status}\` and did not produce a reviewable draft.`,
              status: "unexpected-state",
            },
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
          });
          return;
        }

        void chat.addToolOutput({
          output: {
            message: "Draft ready. Please accept changes or reject changes.",
            status: "draft-ready",
          },
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
        });
      } catch (error) {
        if (env.NODE_ENV === "development") {
          console.debug("[error]", {
            error,
          });
        }

        void chat.addToolOutput({
          output: {
            error,
            message: `Error when calling the tool: ${toErrorMessage(error)}`,
            status: "error",
          },
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
        });
      } finally {
        cleanUpBeforeChange?.();
      }
    },
    inputSchema: zWriteInput,
    name: "write",
  });

  return tool;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
