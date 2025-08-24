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
        const model = JSON.parse(result.request.body || "{}").model;
        const provider = Object.keys(result.providerMetadata ?? {})[0] || "";

        if (result.usage && session.user?.id) {
          await api.ai.trackLLMUsage({
            inputTokens: result.usage.promptTokens,
            metadata: {
              message_count: messages.length,
              request_type: "chat",
            },
            model,
            outputTokens: result.usage.completionTokens,
            provider,
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
