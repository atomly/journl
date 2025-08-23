import { db, insertLLMTokenUsage } from "@acme/db";
import { journlAgent } from "~/ai/mastra/agents/journl-agent";
import { getSession } from "~/auth/server";

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
          await db.transaction(async (tx) => {
            await insertLLMTokenUsage(tx, {
              inputTokens: result.usage.promptTokens,
              metadata: {
                message_count: messages.length,
                request_type: "chat",
              }, // Update this based on your agent configuration
              model,
              outputTokens: result.usage.completionTokens,
              provider, // fallback since provider not available in result
              userId: session.user.id,
            });
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
