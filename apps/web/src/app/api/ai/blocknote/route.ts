import { USAGE_UNITS } from "@acme/db/usage";
import {
  aiDocumentFormats,
  injectDocumentStateMessages,
  toolDefinitionsToToolSet,
} from "@blocknote/xl-ai";
import { convertToModelMessages, streamText } from "ai";
import { after, type NextRequest } from "next/server";
import { getEditorAgentPrompt } from "~/ai/agents/editor-agent";
import { miniModel } from "~/ai/providers/openai/text";
import { handler as corsHandler } from "~/app/api/_cors/cors";
import { withAuthGuard } from "~/auth/guards";
import { env } from "~/env";
import { withUsageGuard } from "~/usage/guards";
import { buildUsageQuotaExceededPayload } from "~/usage/quota-error";
import { startModelUsage } from "~/workflows/model-usage";

const handler = withAuthGuard(
  withUsageGuard(
    async ({ user }, req: NextRequest) => {
      const requestId = crypto.randomUUID();
      const startedAt = Date.now();
      const payload = (await req.json()) as {
        messages?: unknown;
        toolDefinitions?: unknown;
      };

      if (
        !Array.isArray(payload.messages) ||
        !isRecord(payload.toolDefinitions)
      ) {
        return Response.json(
          {
            error: "Invalid BlockNote AI payload.",
            requestId,
          },
          {
            status: 400,
          },
        );
      }

      const messages = payload.messages as Parameters<
        typeof injectDocumentStateMessages
      >[0];
      const toolDefinitions = payload.toolDefinitions as Parameters<
        typeof toolDefinitionsToToolSet
      >[0];

      if (env.NODE_ENV === "development") {
        console.debug("[BlockNoteAI][request]", {
          hasDocumentState: hasDocumentStateMessage(messages),
          messageCount: messages.length,
          requestId,
          toolDefinitionCount: Object.keys(toolDefinitions).length,
          userId: user.id,
        });
      }

      const stream = streamText({
        messages: await convertToModelMessages(
          injectDocumentStateMessages(messages),
        ),
        model: miniModel,
        onError: ({ error }) => {
          console.error("[BlockNoteAI][stream-error]", {
            error,
            requestId,
          });
        },
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
        system: getEditorAgentPrompt(aiDocumentFormats.html.systemPrompt),
        toolChoice: "required",
        tools: toolDefinitionsToToolSet(toolDefinitions),
      });

      after(async () => {
        try {
          const usage = await stream.usage;
          const durationMs = Date.now() - startedAt;

          if (env.NODE_ENV === "development") {
            console.debug("[Usage] BlockNote", {
              durationMs,
              requestId,
              usage,
            });
          }

          await startModelUsage({
            metrics: [
              {
                quantity: usage.inputTokens || 0,
                unit: USAGE_UNITS.INPUT_TOKENS,
              },
              {
                quantity: usage.outputTokens || 0,
                unit: USAGE_UNITS.OUTPUT_TOKENS,
              },
              {
                quantity: usage.reasoningTokens || 0,
                unit: USAGE_UNITS.REASONING_TOKENS,
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

      const response = stream.toUIMessageStreamResponse();
      response.headers.set("X-BlockNote-Request-ID", requestId);

      return response;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasDocumentStateMessage(messages: unknown[]) {
  return messages.some((message) => {
    if (!isRecord(message)) {
      return false;
    }

    const metadata = message.metadata;
    if (!isRecord(metadata)) {
      return false;
    }

    return "documentState" in metadata;
  });
}
