import {
  aiDocumentFormats,
  injectDocumentStateMessages,
  toolDefinitionsToToolSet,
} from "@blocknote/xl-ai";
import { convertToModelMessages, streamText } from "ai";
import { after, type NextRequest } from "next/server";
import { model } from "~/ai/providers/openai/text";
import { handler as corsHandler } from "~/app/api/_cors/cors";
import { withAuthGuard } from "~/auth/guards";
import { withUsageGuard } from "~/usage/guards";
import { startModelUsage } from "~/workflows/model-usage";

const handler = withAuthGuard(
  withUsageGuard(
    async ({ user }, req: NextRequest) => {
      const { messages, toolDefinitions } = await req.json();

      const stream = streamText({
        messages: await convertToModelMessages(
          injectDocumentStateMessages(messages),
        ),
        model, // see https://ai-sdk.dev/docs/foundations/providers-and-models
        system: aiDocumentFormats.html.systemPrompt,
        toolChoice: "required",
        tools: toolDefinitionsToToolSet(toolDefinitions),
      });

      after(async () => {
        try {
          const usage = await stream.usage;

          console.debug("[Usage] BlockNote", {
            usage,
          });

          await startModelUsage({
            metrics: [
              {
                quantity: usage.inputTokens || 0,
                unit: "input_tokens",
              },
              {
                quantity: usage.outputTokens || 0,
                unit: "output_tokens",
              },
              {
                quantity: usage.reasoningTokens || 0,
                unit: "reasoning_tokens",
              },
            ],
            modelId: model.modelId,
            modelProvider: model.provider,
            userId: user.id,
          });
        } catch (error) {
          console.error("[usage tracking] error:", error);
        }
      });

      return stream.toUIMessageStreamResponse();
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
