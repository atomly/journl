import "server-only";

import { USAGE_UNITS, type UsageUnit } from "@acme/db/usage";
import { handleChatStream } from "@mastra/ai-sdk";
import { convertMessages } from "@mastra/core/agent";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  getToolName,
  isToolUIPart,
  type UIMessage,
} from "ai";
import type { User } from "better-auth";
import {
  getJournlUserThread,
  journlMini,
  journlNano,
  setJournlRequestContext,
} from "~/ai/mastra/agents/journl-agent";
import type { JournlAgentContext } from "~/ai/mastra/agents/journl-agent-context";
import {
  getLastUserMessage,
  inferUserIntent,
} from "~/ai/mastra/agents/journl-agent-intent";
import {
  getOpenAIReasoningEffort,
  parseJournlAgentReasoning,
} from "~/ai/mastra/agents/journl-agent-reasoning";
import { mastra } from "~/ai/mastra/mastra";
import { zWriteOutput } from "~/ai/tools/write/schema";
import { startModelUsage } from "~/workflows/model-usage";
import type { JournlChatRequest } from "./chat-request";

const JOURNL_AGENT_MAX_STEPS = 5;
const JOURNL_AGENT_TOOL_CALL_CONCURRENCY = 4;

/** Run an authenticated conversation through the AI SDK 7 transport.
 * Memory ownership and usage identity come from the server session. Request
 * cancellation reaches Mastra and tools rather than leaving a model run alive.
 */
export async function streamJournlChat({
  request,
  user,
  signal,
}: {
  request: JournlChatRequest;
  user: User;
  signal: AbortSignal;
}) {
  const { messages, context, trigger } = request;
  const rootThreadId = getJournlUserThread(user);
  const memoryThreadId = request.threadId ?? rootThreadId;
  if (memoryThreadId !== rootThreadId) {
    const [{ journlMemory }, { requireChatThread }] = await Promise.all([
      import("~/ai/mastra/memory/memory"),
      import("./chat-threads"),
    ]);
    await requireChatThread(journlMemory, user.id, memoryThreadId);
  }
  const latest = messages.at(-1);
  const writeResult =
    latest?.role === "assistant"
      ? latest.parts.find(
          (part) =>
            isToolUIPart(part) &&
            getToolName(part) === "write" &&
            ["output-available", "output-error", "output-denied"].includes(
              part.state,
            ),
        )
      : undefined;
  if (latest && writeResult && isToolUIPart(writeResult)) {
    const outcome =
      "output" in writeResult
        ? zWriteOutput.safeParse(writeResult.output)
        : undefined;
    return finishWritingResult({
      message: latest,
      outcomeMessage: outcome?.success ? outcome.data.message : undefined,
      signal,
      status: outcome?.success ? outcome.data.status : "error",
      threadId: memoryThreadId,
      toolCallId: writeResult.toolCallId,
      user,
    });
  }
  const reasoning = parseJournlAgentReasoning(context.reasoning);
  let prompt = getLastUserMessage(messages);
  if (!prompt && messages.at(-1)?.role === "assistant") {
    const { journlMemory } = await import("~/ai/mastra/memory/memory");
    const { messages: history } = await journlMemory.recall({
      hideSignals: true,
      orderBy: { direction: "DESC", field: "createdAt" },
      perPage: 30,
      resourceId: user.id,
      threadId: memoryThreadId,
    });
    const userMessage = [...history]
      .reverse()
      .find((message) => message.role === "user");
    prompt =
      userMessage?.content.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n") ?? "";
  }
  const intent = inferUserIntent(prompt);
  const journlAgent = intent === "search" ? journlNano : journlMini;

  const agentContext = setJournlRequestContext({
    ...context,
    user: { name: user.name },
  } satisfies JournlAgentContext);
  agentContext.set("researchUserId", user.id);
  agentContext.set("researchCache", new Map());
  const stream = await handleChatStream({
    agentId: journlAgent.id,
    mastra,
    onError: () =>
      "The assistant could not complete this request. Please retry.",
    params: {
      abortSignal: signal,
      maxSteps: JOURNL_AGENT_MAX_STEPS,
      memory: {
        resource: user.id,
        thread: memoryThreadId,
      },
      messages,
      // Account for reported steps even when a later step fails or is cancelled.
      onStepFinish: async (step) => {
        try {
          const { modelId, provider } =
            step.model?.provider && step.model.modelId
              ? { modelId: step.model.modelId, provider: step.model.provider }
              : await journlAgent.getModel();

          const metrics: Array<{ quantity: number; unit: UsageUnit }> = [
            {
              quantity: step.usage.inputTokens || 0,
              unit: USAGE_UNITS.INPUT_TOKENS,
            },
            {
              quantity: step.usage.outputTokens || 0,
              unit: USAGE_UNITS.OUTPUT_TOKENS,
            },
            {
              quantity: step.usage.reasoningTokens || 0,
              unit: USAGE_UNITS.REASONING_TOKENS,
            },
          ];

          await startModelUsage({
            metrics,
            modelId,
            modelProvider: provider,
            userId: user.id,
          });
        } catch (error) {
          console.error("[usage tracking] error:", error);
        }
      },
      providerOptions: {
        openai: {
          include: ["reasoning.encrypted_content"],
          reasoningEffort: getOpenAIReasoningEffort(reasoning),
          // When using OpenAI, the `store` has to be turned off to avoid this
          // issue with Mastra's message history: https://github.com/vercel/ai/issues/7099#issuecomment-3567630392
          store: false,
        },
      },
      requestContext: agentContext,
      toolCallConcurrency: JOURNL_AGENT_TOOL_CALL_CONCURRENCY,
      trigger,
    },
    sendSources: true,
    version: "v7",
  });

  return createUIMessageStreamResponse({
    stream,
  });
}

/** Tool outcomes are application state. Persist and report them without asking a model to reinterpret them. */
async function finishWritingResult({
  message,
  outcomeMessage,
  toolCallId,
  status,
  threadId,
  user,
  signal,
}: {
  message: UIMessage;
  outcomeMessage?: string;
  toolCallId: string;
  status: string;
  threadId: string;
  user: User;
  signal: AbortSignal;
}) {
  const memory = await mastra.getAgentById(journlMini.id).getMemory();
  if (!memory) throw new Error("Conversation storage is unavailable.");
  const { messages } = await memory.recall({
    hideSignals: true,
    include: [{ id: message.id, withNextMessages: 0, withPreviousMessages: 0 }],
    perPage: 1,
    resourceId: user.id,
    threadId,
  });
  const stored = messages.find(
    (entry) =>
      entry.id === message.id &&
      entry.role === "assistant" &&
      entry.resourceId === user.id &&
      entry.threadId === threadId,
  );
  if (
    !stored?.content.parts.some(
      (part) =>
        part.type === "tool-invocation" &&
        part.toolInvocation.toolName === "write" &&
        part.toolInvocation.toolCallId === toolCallId,
    )
  )
    throw new Error("The writing result does not belong to this conversation.");
  const text =
    status === "applied"
      ? "Edit applied. Use Undo to revert it."
      : status === "unchanged"
        ? "No changes were made. Your writing is unchanged."
        : status === "cancelled"
          ? "Writing stopped. Your original writing is unchanged."
          : status === "conflict"
            ? "The edit did not apply because the writing changed. Your writing was kept."
            : `The edit did not apply. Your writing was kept.${outcomeMessage ? `\n\n${outcomeMessage}` : ""}`;
  const completed: UIMessage = {
    ...message,
    parts: [...message.parts, { type: "step-start" }, { text, type: "text" }],
  };
  const converted = convertMessages([completed]).to("Mastra.V2")[0];
  if (!converted) throw new Error("The writing result could not be stored.");
  signal.throwIfAborted();
  await memory.saveMessages({
    messages: [{ ...stored, content: converted.content }],
  });
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ messageId: message.id, type: "start" });
        writer.write({ type: "start-step" });
        writer.write({ id: toolCallId, type: "text-start" });
        writer.write({ delta: text, id: toolCallId, type: "text-delta" });
        writer.write({ id: toolCallId, type: "text-end" });
        writer.write({ type: "finish-step" });
        writer.write({ finishReason: "stop", type: "finish" });
      },
    }),
  });
}
