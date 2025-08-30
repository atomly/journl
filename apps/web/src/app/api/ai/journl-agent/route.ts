import { journlAgent } from "~/ai/mastra/agents/journl-agent";
import { getSession } from "~/auth/server";
import { api } from "~/trpc/server";

export const maxDuration = 30; // Allow streaming responses up to 30 seconds

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const session = await getSession();

    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const result = await journlAgent.stream(messages, {
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
    });

    return result.toDataStreamResponse({
      getErrorMessage(error) {
        return `An error occurred while processing your request. ${error instanceof Error ? error.message : JSON.stringify(error)}`;
      },
    });
  } catch (error) {
    console.error("[api.chat.route] error 👀", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
