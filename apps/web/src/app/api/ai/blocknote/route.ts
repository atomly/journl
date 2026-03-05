import { USAGE_UNITS } from "@acme/db/usage";
import {
  aiDocumentFormats,
  injectDocumentStateMessages,
  toolDefinitionsToToolSet,
} from "@blocknote/xl-ai";
import type { MastraMessageContentV2 } from "@mastra/core/agent";
import type { MastraMessagePart } from "@mastra/core/agent/message-list";
import type { MastraDBMessage } from "@mastra/core/memory";
import { convertToModelMessages, streamText } from "ai";
import type { User } from "better-auth";
import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { getEditorAgentPrompt } from "~/ai/agents/editor-agent";
import { getJournlUserThread } from "~/ai/agents/journl-agent";
import { journlMastraStore } from "~/ai/mastra/postgres-store";
import { miniModel } from "~/ai/providers/openai/text";
import { zManipulateEditorInput } from "~/ai/tools/manipulate-editor/schema";
import { handler as corsHandler } from "~/app/api/_cors/cors";
import { withAuthGuard } from "~/auth/guards";
import { env } from "~/env";
import { withUsageGuard } from "~/usage/guards";
import { buildUsageQuotaExceededPayload } from "~/usage/quota-error";
import { startModelUsage } from "~/workflows/model-usage";

const MAX_THREAD_CONTEXT_MESSAGES = 24;

const zBlockNoteRequest = z.object({
  messages: z.custom<Parameters<typeof injectDocumentStateMessages>[0]>(
    (value) => Array.isArray(value),
    "messages must be an array",
  ),
  reasoningEffort:
    zManipulateEditorInput.def.shape.reasoningEffort.default("low"),
  toolDefinitions: z.object(),
});

export type BlockNoteRequest = z.infer<typeof zBlockNoteRequest>;

const handler = withAuthGuard(
  withUsageGuard(
    async ({ user }, req: NextRequest) => {
      const { data, success } = zBlockNoteRequest.safeParse(await req.json());

      if (!success) {
        return Response.json(
          {
            error: "Invalid BlockNote AI payload.",
          },
          {
            status: 400,
          },
        );
      }

      const { reasoningEffort, messages, toolDefinitions } = data;

      const stream = streamText({
        messages: await convertToModelMessages(
          injectDocumentStateMessages(messages),
        ),
        model: miniModel,
        onError: ({ error }) => {
          console.error("[BlockNoteAI][stream-error]", {
            error,
          });
        },
        providerOptions: {
          openai: {
            include: ["reasoning.encrypted_content"],
            reasoningEffort,
            // When using OpenAI, the `store` has to be turned off to avoid this
            // issue with Mastra's message history: https://github.com/vercel/ai/issues/7099#issuecomment-3567630392
            store: false,
          },
        },
        system: getEditorAgentPrompt(aiDocumentFormats.html.systemPrompt, {
          threadMessages: await getThreadMessages(user),
        }),
        toolChoice: "required",
        tools: toolDefinitionsToToolSet(toolDefinitions),
      });

      after(async () => {
        try {
          const usage = await stream.usage;

          if (env.NODE_ENV === "development") {
            console.debug("[Usage] BlockNote", {
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
                quantity: usage.outputTokenDetails.reasoningTokens || 0,
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

async function getThreadMessages(user: User) {
  try {
    const memoryStore = await journlMastraStore.getStore("memory");

    if (!memoryStore) {
      return undefined;
    }

    const memoryThreadId = getJournlUserThread(user);

    const { messages } = await memoryStore.listMessages({
      orderBy: {
        direction: "DESC",
        field: "createdAt",
      },
      page: 0,
      perPage: MAX_THREAD_CONTEXT_MESSAGES,
      resourceId: user.id,
      threadId: memoryThreadId,
    });

    if (messages.length === 0) {
      return undefined;
    }

    const text = messages
      .map((message) => mastraMessageToText(message))
      .filter((line) => line.length > 0)
      .join("\n");

    return text;
  } catch (error) {
    console.warn("[BlockNoteAI][thread-context] failed to fetch memory", {
      error,
      userId: user.id,
    });
    return undefined;
  }
}

function mastraMessageToText(message: MastraDBMessage) {
  const role =
    message.role === "assistant"
      ? "Assistant"
      : message.role === "user"
        ? "User"
        : undefined;

  if (!role) {
    return "";
  }

  const text = mastraMessageContentToText(message.content);

  if (!text) {
    return "";
  }

  return `${role}: ${text}`;
}

function mastraMessageContentToText(content: MastraMessageContentV2) {
  return content.parts
    .map((part) => mastraMessagePartToText(part))
    .join("\n")
    .trim();
}

function mastraMessagePartToText(part: MastraMessagePart) {
  if (part.type !== "text") {
    return undefined;
  }

  if (typeof part.text !== "string") {
    return undefined;
  }

  return part.text;
}
