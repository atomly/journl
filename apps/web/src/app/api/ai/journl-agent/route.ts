import { handleChatStream } from "@mastra/ai-sdk";
import { Mastra } from "@mastra/core";
import { createUIMessageStreamResponse } from "ai";
import {
  getJournlUserThread,
  journlMini,
  journlNano,
  setJournlRequestContext,
} from "~/ai/agents/journl-agent";
import {
  getLastUserMessage,
  inferUserIntent,
} from "~/ai/agents/journl-agent-intent";
import {
  getGPTReasoningEffort,
  parseJournlAgentReasoning,
} from "~/ai/agents/journl-agent-reasoning";
import type { JournlAgentState } from "~/ai/agents/journl-agent-state";
import { journlMastraStore } from "~/ai/mastra/postgres-store";
import { handler as corsHandler } from "~/app/api/_cors/cors";
import { withAuthGuard } from "~/auth/guards";
import { withUsageGuard } from "~/usage/guards";
import { buildUsageQuotaExceededPayload } from "~/usage/quota-error";
import { startModelUsage } from "~/workflows/model-usage";

export const maxDuration = 30; // Allow streaming responses up to 30 seconds

const JOURNL_AGENT_MAX_STEPS = 5;
const JOURNL_AGENT_TOOL_CALL_CONCURRENCY = 4;

const mastra = new Mastra({
  agents: {
    journlMini,
    journlNano,
  },
  storage: journlMastraStore,
});

const handler = withAuthGuard(
  withUsageGuard(
    async ({ user }, req: Request) => {
      try {
        const { messages, ...rest } = await req.json();
        const memoryThreadId = getJournlUserThread(user);
        const reasoning = parseJournlAgentReasoning(rest.context?.reasoning);
        const intent = inferUserIntent(getLastUserMessage(messages));
        const journlAgent = intent === "search" ? journlNano : journlMini;

        const stream = await handleChatStream({
          agentId: journlAgent.id,
          mastra,
          params: {
            maxSteps: JOURNL_AGENT_MAX_STEPS,
            memory: {
              resource: user.id,
              thread: memoryThreadId,
            },
            messages,
            onFinish: async ({ totalUsage }) => {
              try {
                const { provider, modelId } = await journlAgent.getModel();

                console.debug("[Usage] JournlAgent", {
                  usage: totalUsage,
                });

                await startModelUsage({
                  metrics: [
                    {
                      quantity: totalUsage.inputTokens || 0,
                      unit: "input_tokens",
                    },
                    {
                      quantity: totalUsage.outputTokens || 0,
                      unit: "output_tokens",
                    },
                    {
                      quantity: totalUsage.reasoningTokens || 0,
                      unit: "reasoning_tokens",
                    },
                  ],
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
                reasoningEffort: getGPTReasoningEffort(reasoning),
                // When using OpenAI, the `store` has to be turned off to avoid this
                // issue with Mastra's message history: https://github.com/vercel/ai/issues/7099#issuecomment-3567630392
                store: false,
              },
            },
            requestContext: setJournlRequestContext({
              ...rest.context,
              user: {
                email: user.email,
                name: user.name,
              },
            } satisfies JournlAgentState),
            toolCallConcurrency: JOURNL_AGENT_TOOL_CALL_CONCURRENCY,
          },
        });

        return createUIMessageStreamResponse({ stream });
      } catch (error) {
        console.error("[api.chat.route] error 👀", error);
        return new Response("Internal Server Error", { status: 500 });
      }
    },
    {
      onUsageLimitExceeded: (error) =>
        Response.json(buildUsageQuotaExceededPayload(error.status), {
          status: 429,
        }),
    },
  ),
  {
    onUnauthorized: () => new Response("Unauthorized", { status: 401 }),
  },
);

export { handler as POST, corsHandler as OPTIONS };
