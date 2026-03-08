import { USAGE_UNITS } from "@acme/db/usage";
import {
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
import { getJournlUserThread } from "~/ai/mastra/agents/journl-agent";
import { getWritingAgentPrompt } from "~/ai/mastra/agents/writing-agent";
import { journlMemory } from "~/ai/mastra/memory/memory";
import { miniModel } from "~/ai/providers/openai/text";
import { zWriteInput } from "~/ai/tools/write/schema";
import { handler as corsHandler } from "~/app/api/_cors/cors";
import { withAuthGuard } from "~/auth/guards";
import { env } from "~/env";
import { withUsageGuard } from "~/usage/guards";
import { buildUsageQuotaExceededPayload } from "~/usage/quota-error";
import { startModelUsage } from "~/workflows/model-usage";

export const maxDuration = 300; // Allow streaming responses up to 300 seconds

const MAX_THREAD_CONTEXT_MESSAGES = 24;

const zMessages = z.custom<Parameters<typeof injectDocumentStateMessages>[0]>(
  (value) => Array.isArray(value),
  "messages must be an array",
);

const zReasoningEffort = zWriteInput.def.shape.reasoningEffort.default("low");

const zToolDefinitions = z.custom<
  Parameters<typeof toolDefinitionsToToolSet>[0]
>((value) => {
  if (!isRecord(value)) {
    return false;
  }

  return "applyDocumentOperations" in value;
}, "toolDefinitions must include applyDocumentOperations");

const zBlockNoteRequest = z.object({
  messages: zMessages,
  reasoningEffort: zReasoningEffort,
  toolDefinitions: zToolDefinitions,
});

export type BlockNoteRequest = z.infer<typeof zBlockNoteRequest>;

const handler = withAuthGuard(
  withUsageGuard(
    async ({ user }, req: NextRequest) => {
      const parsedPayload = zBlockNoteRequest.safeParse(await req.json());

      if (!parsedPayload.success) {
        return Response.json(
          {
            error: "Invalid BlockNote AI payload.",
            ...(env.NODE_ENV === "development"
              ? { details: z.treeifyError(parsedPayload.error) }
              : {}),
          },
          {
            status: 400,
          },
        );
      }

      const { reasoningEffort, messages, toolDefinitions } = parsedPayload.data;

      const threadMessages = await getThreadMessages(user);

      const systemPrompt = getWritingAgentPrompt(threadMessages);

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
        system: systemPrompt,
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
    const memoryThreadId = getJournlUserThread(user);

    const { messages } = await journlMemory.recall({
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
  const text = content.parts
    .map((part) => mastraMessagePartToText(part))
    .join("\n")
    .trim();

  return text;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
