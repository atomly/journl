import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  branchChatThread,
  ChatThreadError,
  listChatThreads,
  readChatThread,
} from "~/ai/server/chat-threads";
import { protectedProcedure } from "../trpc";

const threadInput = z.object({ threadId: z.string().min(1).max(200) });
async function withMemory<T>(
  action: (
    memory: typeof import("~/ai/mastra/memory/memory").journlMemory,
  ) => Promise<T>,
) {
  try {
    const { journlMemory } = await import("~/ai/mastra/memory/memory");
    return await action(journlMemory);
  } catch (error) {
    if (error instanceof ChatThreadError)
      throw new TRPCError({ code: error.code, message: error.message });
    console.error("[ai.chat.history] request failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "The conversation is unavailable. Please retry.",
    });
  }
}
export const chatRouter = {
  branch: protectedProcedure
    .input(
      threadInput.extend({
        kind: z.enum(["edit", "retry"]),
        messageId: z.string().min(1).max(200),
        pendingPrompt: z
          .object({
            previousMessageId: z.string().min(1).max(200).optional(),
            text: z.string().min(1).max(100000),
          })
          .optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      withMemory((memory) =>
        branchChatThread(memory, ctx.session.user.id, input),
      ),
    ),
  history: protectedProcedure
    .input(threadInput)
    .query(({ ctx, input }) =>
      withMemory((memory) =>
        readChatThread(memory, ctx.session.user.id, input.threadId),
      ),
    ),
  list: protectedProcedure.query(({ ctx }) =>
    withMemory((memory) => listChatThreads(memory, ctx.session.user.id)),
  ),
} satisfies TRPCRouterRecord;
