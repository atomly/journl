import { handleChatStream } from "@mastra/ai-sdk";
import { Mastra } from "@mastra/core";
import { createUIMessageStreamResponse } from "ai";
import { journlAgent, setJournlRequestContext } from "~/ai/agents/journl-agent";
import type { JournlAgentState } from "~/ai/agents/journl-agent-state";
import { handler as corsHandler } from "~/app/api/_cors/cors";
import { getSession } from "~/auth/server";
import { api } from "~/trpc/server";

export const maxDuration = 30; // Allow streaming responses up to 30 seconds

const mastra = new Mastra({
  agents: {
    journlAgent,
  },
});

async function handler(req: Request) {
  const session = await getSession();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

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

            await api.usage.trackModelUsage({
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
              model_id: modelId,
              model_provider: provider,
              user_id: session.user.id,
            });
          } catch (error) {
            console.error("[usage tracking] error:", error);
          }
        },
        requestContext: setJournlRequestContext({
          ...rest.context,
          user: {
            email: session.user.email,
            name: session.user.name,
          },
        } satisfies JournlAgentState),
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error("[api.chat.route] error 👀", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export { handler as POST, corsHandler as OPTIONS };
