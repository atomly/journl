"use client";
import { stripOpenAICitationTokens } from "~/ai/utils/openai-utils";
import { useJournlAgent } from "~/hooks/use-journl-agent";
import { createClientTool } from "../../utils/create-client-tool";
import { zWriteInput } from "./schema";

export function useWriteTool() {
  const { getEditors, getEditTarget } = useJournlAgent();
  return createClientTool({
    execute: async (toolCall, chat) => {
      const target = getEditTarget();
      const entry =
        target && getEditors().get(target.id) === target ? target : undefined;
      const output = entry
        ? await entry.session.run({
            instruction: stripOpenAICitationTokens(toolCall.input.agentPrompt),
            reasoningEffort: toolCall.input.reasoningEffort,
          })
        : {
            message:
              "The active document changed or is not ready. Send your request again from the page you want to edit.",
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
