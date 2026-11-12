"use client";
import { getLastUserMessage } from "~/ai/mastra/agents/journl-agent-intent";
import { getOpenAIReasoningEffort } from "~/ai/mastra/agents/journl-agent-reasoning";
import { getWritingContext } from "~/ai/writing-context";
import { useJournlAgent } from "~/hooks/use-journl-agent";
import { createClientTool } from "../../utils/create-client-tool";
import { zWriteInput } from "./schema";

export function useWriteTool() {
  const { getEditors, getEditTarget, getReasoning, claimWriteRun } =
    useJournlAgent();
  return createClientTool({
    execute: async (toolCall, chat) => {
      if (!claimWriteRun()) {
        void chat.addToolOutput({
          output: {
            message:
              "This user request already used its writing run. Do not call write again. Report the original write result. This applies only to this request; a new user request permits another run.",
            status: "error",
          },
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
        });
        return;
      }
      const target = getEditTarget();
      const entry =
        target && getEditors().get(target.id) === target ? target : undefined;
      const output = entry
        ? await entry.session.run({
            conversation: getWritingContext(chat.messages),
            instruction: getLastUserMessage(chat.messages),
            reasoningEffort: getOpenAIReasoningEffort(getReasoning()),
          })
        : {
            message:
              "The active document changed or is not ready. Send your request again from the page you want to edit.",
            status: "error",
          };
      // The SDK processes onToolCall inside its message queue. Awaiting this
      // queued update here would deadlock that same queue.
      void chat.addToolOutput({
        output: { ...output, ...(entry ? { targetEditor: entry.id } : {}) },
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
      });
    },
    inputSchema: zWriteInput,
    name: "write",
  });
}
