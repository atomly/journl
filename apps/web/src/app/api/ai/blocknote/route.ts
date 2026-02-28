import {
  aiDocumentFormats,
  injectDocumentStateMessages,
  toolDefinitionsToToolSet,
} from "@blocknote/xl-ai";
import { convertToModelMessages, streamText } from "ai";
import { after, type NextRequest } from "next/server";
import { buildJournlEditorSystemPrompt } from "~/ai/prompts/editor-system-prompt";
import { miniModel } from "~/ai/providers/openai/text";
import { handler as corsHandler } from "~/app/api/_cors/cors";
import { withAuthGuard } from "~/auth/guards";
import { withUsageGuard } from "~/usage/guards";
import { buildUsageQuotaExceededPayload } from "~/usage/quota-error";
import { startModelUsage } from "~/workflows/model-usage";

const handler = withAuthGuard(
  withUsageGuard(
    async ({ user }, req: NextRequest) => {
      const { messages, toolDefinitions } = await req.json();

      const stream = streamText({
        messages: await convertToModelMessages(
          injectDocumentStateMessages(messages),
        ),
        model: miniModel,
        providerOptions: {
          openai: {
            include: ["reasoning.encrypted_content"],
            // TODO: Integrate and map the JournlReasoning here.
            reasoningEffort: "low",
            // When using OpenAI, the `store` has to be turned off to avoid this
            // issue with Mastra's message history: https://github.com/vercel/ai/issues/7099#issuecomment-3567630392
            store: false,
          },
        },
        system: buildJournlEditorSystemPrompt(
          aiDocumentFormats.html.systemPrompt,
        ),
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
            modelId: miniModel.modelId,
            modelProvider: miniModel.provider,
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
        Response.json(buildUsageQuotaExceededPayload(error.status), {
          status: 429,
        }),
    },
  ),
  {
    onUnauthorized: () => new Response("Unauthorized", { status: 401 }),
  },
);

export { handler as POST, corsHandler as OPTIONS };
