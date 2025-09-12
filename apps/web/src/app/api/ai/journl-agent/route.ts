import { journlAgent, setJournlRuntimeContext } from "~/ai/agents/journl-agent";
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
      onFinish: async (result) => {
        const modelData = await journlAgent.getModel();

        const provider = modelData.provider;
        const model = modelData.modelId;

        if (result.usage && session.user?.id) {
          await api.usage.trackModelUsage({
            metrics: [
              {
                quantity: result.usage.promptTokens,
                unit: "input_tokens",
              },
              {
                quantity: result.usage.completionTokens,
                unit: "output_tokens",
              },
            ],
            model_id: model,
            model_provider: provider,
            user_id: session.user.id,
          });
        }
      },
      runtimeContext: setJournlRuntimeContext(rest.context),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[api.chat.route] error 👀", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export { handler as POST, corsHandler as OPTIONS };
