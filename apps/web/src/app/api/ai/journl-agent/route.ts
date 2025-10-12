import { after } from "next/server";
import { journlAgent, setJournlRuntimeContext } from "~/ai/agents/journl-agent";
import type { JournlAgentContext } from "~/ai/agents/journl-agent-context";
import { handler as corsHandler } from "~/app/api/_cors/cors";
import { getSession } from "~/auth/server";
import { api } from "~/trpc/server";

export const maxDuration = 30; // Allow streaming responses up to 30 seconds

async function handler(req: Request) {
  const session = await getSession();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { messages, ...rest } = await req.json();

    const result = await journlAgent.streamVNext(messages, {
      format: "aisdk",
      runtimeContext: setJournlRuntimeContext({
        ...rest.context,
        user: {
          email: session.user.email,
          name: session.user.name,
        },
      } satisfies JournlAgentContext),
    });

    if (session.user?.id) {
      after(async () => {
        try {
          const fullOutput = await result.getFullOutput();
          const usage = fullOutput.usage;

          if (usage) {
            const modelData = await journlAgent.getModel();
            const provider = modelData.provider;
            const model = modelData.modelId;

            await api.usage.trackModelUsage({
              metrics: [
                {
                  quantity: usage.promptTokens || 0,
                  unit: "input_tokens",
                },
                {
                  quantity: usage.completionTokens || 0,
                  unit: "output_tokens",
                },
                {
                  quantity: usage.reasoningTokens || 0,
                  unit: "reasoning_tokens",
                },
              ],
              model_id: model,
              model_provider: provider,
              user_id: session.user.id,
            });
          }
        } catch (error) {
          console.error("[usage tracking] error:", error);
        }
      });
    }

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[api.chat.route] error 👀", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export { handler as POST, corsHandler as OPTIONS };
