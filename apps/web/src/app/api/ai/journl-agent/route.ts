import { handleChatStream } from "@mastra/ai-sdk";
import { Mastra } from "@mastra/core";
import { createUIMessageStreamResponse } from "ai";
import { journlAgent, setJournlRequestContext } from "~/ai/agents/journl-agent";
import type { JournlAgentState } from "~/ai/agents/journl-agent-state";
import { handler as corsHandler } from "~/app/api/_cors/cors";
import { withAuthGuard } from "~/auth/guards";
import { withUsageGuard } from "~/usage/guards";
import { startModelUsage } from "~/workflows/model-usage";

export const maxDuration = 30; // Allow streaming responses up to 30 seconds

const mastra = new Mastra({
  agents: {
    journlAgent,
  },
});

const handler = withAuthGuard(
  withUsageGuard(
    async ({ user }, req: Request) => {
      try {
        const { messages, ...rest } = await req.json();

        const stream = await handleChatStream({
          agentId: journlAgent.id,
          mastra,
          params: {
            messages,
            onFinish: async ({ totalUsage, model }) => {
              try {
                let { provider, modelId } = model ?? {};

                if (!provider || !modelId) {
                  const modelData = await journlAgent.getModel();
                  provider = modelData.provider;
                  modelId = modelData.modelId;
                }

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
            requestContext: setJournlRequestContext({
              ...rest.context,
              user: {
                email: user.email,
                name: user.name,
              },
            } satisfies JournlAgentState),
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
        Response.json(
          {
            error: "Usage quota exceeded",
            usage: error.status,
          },
          { status: 429 },
        ),
    },
  ),
  {
    onUnauthorized: () => new Response("Unauthorized", { status: 401 }),
  },
);

export { handler as POST, corsHandler as OPTIONS };
