import {
  aiDocumentFormats,
  injectDocumentStateMessages,
  toolDefinitionsToToolSet,
} from "@blocknote/xl-ai";
import { convertToModelMessages, streamText } from "ai";
import { after, type NextRequest } from "next/server";
import { start } from "workflow/api";
import { model } from "~/ai/providers/openai/text";
import { handler as corsHandler } from "~/app/api/_cors/cors";
import { getSession } from "~/auth/server";
import { onModelUsage } from "~/workflows/on-model-usage";

async function handler(req: NextRequest) {
  const session = await getSession();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

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

      await start(onModelUsage, [
        {
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
          userId: session.user.id,
        },
      ]);
    } catch (error) {
      console.error("[usage tracking] error:", error);
    }
  });

  return stream.toUIMessageStreamResponse();
}

export { handler as POST, corsHandler as OPTIONS };
