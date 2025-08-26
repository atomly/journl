import { eq } from "@acme/db";
import { UsageEvent, UsageEventStatus } from "@acme/db/schema";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";
import { publicProcedure } from "../trpc.js";

export const usageRouter = {
  trackAiModelUsage: publicProcedure
    .input(
      z.object({
        metadata: z.record(z.string(), z.string()).optional(),
        metrics: z.array(z.object({ quantity: z.number(), unit: z.string() })),
        model_id: z.string(),
        model_provider: z.string(),
        user_id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.db.insert(UsageEvent).values(input);
      } catch (error) {
        console.error("Database error in usage.createUsageEvent:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create usage event",
        });
      }
    }),
  updateUsageEventStatus: publicProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(UsageEventStatus.enumValues),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.db
          .update(UsageEvent)
          .set({
            status: input.status,
          })
          .where(eq(UsageEvent.id, input.id));
      } catch (error) {
        console.error("Database error in usage.processUsageEvent:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to process usage event",
        });
      }
    }),
} satisfies TRPCRouterRecord;
