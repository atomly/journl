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
        // Store LLM token usage
        if (result.usage && session.user?.id) {
          try {
            await db.transaction(async (tx) => {
              await insertLLMTokenUsage(tx, {
                inputTokens: result.usage.promptTokens,
                metadata: {
                  message_count: messages.length,
                  request_type: "chat",
                }, // Update this based on your agent configuration
                model: "gpt-4o-mini",
                outputTokens: result.usage.completionTokens,
                provider: "openai",
                userId: session.user.id,
              });
            });
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error("Failed to store LLM token usage:", error);
          }
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
