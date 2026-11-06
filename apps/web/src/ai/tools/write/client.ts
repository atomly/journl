"use client";
import { stripOpenAICitationTokens } from "~/ai/utils/openai-utils";
import { useJournlAgent } from "~/hooks/use-journl-agent";
import { createClientTool } from "../../utils/create-client-tool";
import { zWriteInput } from "./schema";

export function useWriteTool() {
  const { getEditors } = useJournlAgent();
  return createClientTool({
    execute: async (toolCall, chat) => {
      const entry = getEditors().get(toolCall.input.targetEditor);
      const output = entry
        ? await entry.session.run({
            instruction: stripOpenAICitationTokens(toolCall.input.agentPrompt),
            reasoningEffort: toolCall.input.reasoningEffort,
          })
        : {
            message:
              "Open and focus the target page or journal entry, then retry.",
            status: "error",
          };
      // The SDK processes onToolCall inside its message queue. Awaiting this
      // queued update here would deadlock that same queue.
      void chat.addToolOutput({
        output,
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
      });
    },
    inputSchema: zWriteInput,
    name: "write",
  });
}
