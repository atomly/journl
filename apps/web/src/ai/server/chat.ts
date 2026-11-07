import "server-only";

import { USAGE_UNITS, type UsageUnit } from "@acme/db/usage";
import { handleChatStream } from "@mastra/ai-sdk";
import type { LLMStepResult } from "@mastra/core/agent";
import { createUIMessageStreamResponse } from "ai";
import type { User } from "better-auth";
import {
  getJournlUserThread,
  journlMini,
  journlNano,
  setJournlRequestContext,
} from "~/ai/mastra/agents/journl-agent";
import type { JournlAgentContext } from "~/ai/mastra/agents/journl-agent-context";
import {
  getLastUserMessage,
  inferUserIntent,
} from "~/ai/mastra/agents/journl-agent-intent";
import {
  getOpenAIReasoningEffort,
  parseJournlAgentReasoning,
} from "~/ai/mastra/agents/journl-agent-reasoning";
import { mastra } from "~/ai/mastra/mastra";
import { isOpenAIWebSearchCall } from "~/ai/utils/openai-utils";
import { startModelUsage } from "~/workflows/model-usage";
import type { JournlChatRequest } from "./chat-request";

const JOURNL_AGENT_MAX_STEPS = 5;
const JOURNL_AGENT_TOOL_CALL_CONCURRENCY = 4;

/** Run an authenticated conversation through the AI SDK 7 transport.
 * Memory ownership and usage identity come from the server session. Request
 * cancellation reaches Mastra and tools rather than leaving a model run alive.
 */
export async function streamJournlChat({
  request,
  user,
  signal,
}: {
  request: JournlChatRequest;
  user: User;
  signal: AbortSignal;
}) {
  const { messages, context, trigger } = request;
  const rootThreadId = getJournlUserThread(user);
  const memoryThreadId = request.threadId ?? rootThreadId;
  if (memoryThreadId !== rootThreadId) {
    const [{ journlMemory }, { requireChatThread }] = await Promise.all([
      import("~/ai/mastra/memory/memory"),
      import("./chat-threads"),
    ]);
    await requireChatThread(journlMemory, user.id, memoryThreadId);
  }
  const reasoning = parseJournlAgentReasoning(context.reasoning);
  const intent = inferUserIntent(getLastUserMessage(messages));
  const journlAgent = intent === "search" ? journlNano : journlMini;

  const stream = await handleChatStream({
    agentId: journlAgent.id,
    mastra,
    onError: () =>
      "The assistant could not complete this request. Please retry.",
    params: {
      abortSignal: signal,
      maxSteps: JOURNL_AGENT_MAX_STEPS,
      memory: {
        resource: user.id,
        thread: memoryThreadId,
      },
      messages,
      // Account for reported steps even when a later step fails or is cancelled.
      onStepFinish: async (step) => {
        try {
          const { modelId, provider } =
            step.model?.provider && step.model.modelId
              ? { modelId: step.model.modelId, provider: step.model.provider }
              : await journlAgent.getModel();

          const metrics: Array<{ quantity: number; unit: UsageUnit }> = [
            {
              quantity: step.usage.inputTokens || 0,
              unit: USAGE_UNITS.INPUT_TOKENS,
            },
            {
              quantity: step.usage.outputTokens || 0,
              unit: USAGE_UNITS.OUTPUT_TOKENS,
            },
            {
              quantity: step.usage.reasoningTokens || 0,
              unit: USAGE_UNITS.REASONING_TOKENS,
            },
          ];

          const webSearchCalls = countBillableWebSearchCalls([step]);
          if (webSearchCalls > 0) {
            metrics.push({
              quantity: webSearchCalls,
              unit: USAGE_UNITS.WEB_SEARCH_CALLS,
            });
          }

          await startModelUsage({
            metrics,
            modelId,
            modelProvider: provider,
            userId: user.id,
          });
        } catch (error) {
          console.error("[usage tracking] error:", error);
        }
      },
      providerOptions: {
        openai: {
          include: ["reasoning.encrypted_content"],
          reasoningEffort: getOpenAIReasoningEffort(reasoning),
          // When using OpenAI, the `store` has to be turned off to avoid this
          // issue with Mastra's message history: https://github.com/vercel/ai/issues/7099#issuecomment-3567630392
          store: false,
        },
      },
      requestContext: setJournlRequestContext({
        ...context,
        user: {
          name: user.name,
        },
      } satisfies JournlAgentContext),
      toolCallConcurrency: JOURNL_AGENT_TOOL_CALL_CONCURRENCY,
      trigger,
    },
    sendSources: true,
    version: "v7",
  });

  return createUIMessageStreamResponse({
    stream,
  });
}

function countBillableWebSearchCalls(steps: LLMStepResult<undefined>[]) {
  let count = 0;

  for (const { toolResults } of steps) {
    for (const result of toolResults) {
      if (isOpenAIWebSearchCall(result)) {
        count += 1;
      }
    }
  }

  return count;
}
