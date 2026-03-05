import { USAGE_UNITS } from "@acme/db/usage";
import {
  aiDocumentFormats,
  injectDocumentStateMessages,
  toolDefinitionsToToolSet,
} from "@blocknote/xl-ai";
import { convertToModelMessages, streamText } from "ai";
import { after, type NextRequest } from "next/server";
import { getEditorAgentPrompt } from "~/ai/agents/editor-agent";
import { parseJournlAgentReasoning } from "~/ai/agents/journl-agent-reasoning";
import { journlMastraStore } from "~/ai/mastra/postgres-store";
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
        journlConversationContext?: unknown;
        journlEditScope?: unknown;
        journlReasoningMode?: unknown;
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
      const conversationContext = parseConversationContext(
        payload.journlConversationContext,
      );
      const threadConversationContext =
        await getThreadConversationContextFromMastra(user.id);
      const mergedConversationContext = mergeConversationContexts({
        inlineConversationContext: conversationContext,
        threadConversationContext,
      });
      const reasoningEffort = resolveEditorReasoningEffort(
        payload.journlReasoningMode,
      );

      if (env.NODE_ENV === "development") {
        console.debug("[BlockNoteAI][request]", {
          hasDocumentState: hasDocumentStateMessage(messages),
          inlineConversationContextChars: conversationContext?.length ?? 0,
          journlEditScope:
            payload.journlEditScope === "selection" ? "selection" : "document",
          journlReasoningMode: payload.journlReasoningMode,
          mergedConversationContextChars:
            mergedConversationContext?.length ?? 0,
          messageCount: messages.length,
          requestId,
          threadConversationContextChars:
            threadConversationContext?.length ?? 0,
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
            reasoningEffort,
            // When using OpenAI, the `store` has to be turned off to avoid this
            // issue with Mastra's message history: https://github.com/vercel/ai/issues/7099#issuecomment-3567630392
            store: false,
          },
        },
        system: getEditorAgentPrompt(aiDocumentFormats.html.systemPrompt, {
          conversationContext: mergedConversationContext,
        }),
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

const MAX_CONVERSATION_CONTEXT_CHARS = 5000;
const MAX_THREAD_CONTEXT_CHARS = 3500;
const MAX_THREAD_CONTEXT_MESSAGES = 24;
const MAX_THREAD_MESSAGE_TEXT_CHARS = 360;

function parseConversationContext(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = sanitizeContextText(value).trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  if (trimmed.length <= MAX_CONVERSATION_CONTEXT_CHARS) {
    return trimmed;
  }

  return `${trimmed.slice(0, MAX_CONVERSATION_CONTEXT_CHARS - 1)}…`;
}

function resolveEditorReasoningEffort(
  mode: unknown,
): "minimal" | "low" | "medium" {
  try {
    parseJournlAgentReasoning(mode);
  } catch {
    // ignore invalid mode and use default below
  }

  // Editor document operations benefit from slightly higher reasoning depth.
  return "medium";
}

async function getThreadConversationContextFromMastra(userId: string) {
  try {
    const memoryStore = await journlMastraStore.getStore("memory");

    if (!memoryStore) {
      return undefined;
    }

    const { messages } = await memoryStore.listMessages({
      orderBy: {
        direction: "DESC",
        field: "createdAt",
      },
      page: 0,
      perPage: MAX_THREAD_CONTEXT_MESSAGES,
      resourceId: userId,
      threadId: getJournlThreadId(userId),
    });

    if (messages.length === 0) {
      return undefined;
    }

    const orderedMessages = [...messages].sort(
      (a, b) => toEpochMs(a.createdAt) - toEpochMs(b.createdAt),
    );

    const lines = orderedMessages
      .map((message) => toThreadContextLine(message))
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return undefined;
    }

    return truncate(lines.join("\n\n"), MAX_THREAD_CONTEXT_CHARS);
  } catch (error) {
    console.warn("[BlockNoteAI][thread-context] failed to fetch memory", {
      error,
      userId,
    });
    return undefined;
  }
}

function getJournlThreadId(userId: string) {
  return `journl:${userId}`;
}

function mergeConversationContexts({
  inlineConversationContext,
  threadConversationContext,
}: {
  inlineConversationContext?: string;
  threadConversationContext?: string;
}) {
  const sections = [
    threadConversationContext
      ? ["[Recent Journl thread context]", threadConversationContext].join("\n")
      : "",
    inlineConversationContext
      ? ["[Current live chat context]", inlineConversationContext].join("\n")
      : "",
  ].filter((section) => section.length > 0);

  if (sections.length === 0) {
    return undefined;
  }

  return truncate(sections.join("\n\n"), MAX_CONVERSATION_CONTEXT_CHARS);
}

function toThreadContextLine(message: { role?: unknown; content?: unknown }) {
  const role =
    message.role === "assistant"
      ? "Assistant"
      : message.role === "user"
        ? "User"
        : undefined;

  if (!role) {
    return "";
  }

  const text = extractMessageText(message.content);

  if (!text) {
    return "";
  }

  return `${role}: ${truncate(text, MAX_THREAD_MESSAGE_TEXT_CHARS)}`;
}

function extractMessageText(content: unknown) {
  if (!isRecord(content)) {
    return "";
  }

  if (Array.isArray(content.parts)) {
    const fromParts = content.parts
      .map((part) => extractTextFromPart(part))
      .filter((part): part is string => typeof part === "string")
      .join("\n")
      .trim();

    if (fromParts.length > 0) {
      return sanitizeContextText(fromParts);
    }
  }

  if (typeof content.content === "string") {
    return sanitizeContextText(content.content);
  }

  return "";
}

function extractTextFromPart(part: unknown) {
  if (!isRecord(part)) {
    return undefined;
  }

  if (part.type !== "text") {
    return undefined;
  }

  if (typeof part.text !== "string") {
    return undefined;
  }

  return part.text;
}

function sanitizeContextText(value: string) {
  const withoutSignature = value
    .replace(/\n?\s*(?:--|—)\s*Journl\s*$/gim, "")
    .replace(/\n?\s*best\s*,\s*journl\s*$/gim, "");

  return withoutSignature.replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxChars: number) {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars - 1)}…`;
}

function toEpochMs(value: unknown) {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}
