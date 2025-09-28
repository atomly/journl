import { and, eq } from "@acme/db";
import { UsageEvent, UsageEventStatus, UsagePeriod } from "@acme/db/schema";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";
import { publicProcedure } from "../trpc.js";
import { getActiveSubscription } from "./subscription.js";

export const usageRouter = {
  getCurrentUsagePeriod: publicProcedure
    .input(z.object({ user_id: z.string() }))
    .query(async ({ ctx, input }) => {
      const now = new Date();

      // First, check if user has an active subscription
      const activeSubscription = await getActiveSubscription({
        ctx,
        userId: input.user_id,
      });

      if (activeSubscription) {
        // Validate subscription has required fields
        if (
          !activeSubscription.periodStart ||
          !activeSubscription.periodEnd ||
          !activeSubscription.plan
        ) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Invalid subscription data",
          });
        }

        // Pro user: try to find existing usage period for current subscription period
        let usagePeriod = await ctx.db.query.UsagePeriod.findFirst({
          where: and(
            eq(UsagePeriod.user_id, input.user_id),
            eq(UsagePeriod.subscription_id, activeSubscription.id),
            eq(UsagePeriod.period_start, activeSubscription.periodStart),
            eq(UsagePeriod.period_end, activeSubscription.periodEnd),
          ),
        });

        if (!usagePeriod) {
          // Create usage period for subscription period
          const [newUsagePeriod] = await ctx.db
            .insert(UsagePeriod)
            .values({
              period_end: activeSubscription.periodEnd,
              period_start: activeSubscription.periodStart,
              plan_id: activeSubscription.plan.id,
              subscription_id: activeSubscription.id,
              user_id: input.user_id,
            })
            .returning();

          usagePeriod = newUsagePeriod;
        }

        return usagePeriod;
      } else {
        // For free users, we will use a monthly usage period (1st of each month) for simplicity
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        );

        // Try to find existing usage period for current month
        let usagePeriod = await ctx.db.query.UsagePeriod.findFirst({
          where: and(
            eq(UsagePeriod.user_id, input.user_id),
            eq(UsagePeriod.period_start, monthStart),
            eq(UsagePeriod.period_end, monthEnd),
          ),
        });

        if (!usagePeriod) {
          // Create usage period for free user
          const [newUsagePeriod] = await ctx.db
            .insert(UsagePeriod)
            .values({
              period_end: monthEnd,
              period_start: monthStart,
              plan_id: null, // Free users don't have a plan_id
              subscription_id: null, // Free users don't have a subscription_id
              user_id: input.user_id,
            })
            .returning();

          usagePeriod = newUsagePeriod;
        }

        return usagePeriod;
      }
    }),
  trackModelUsage: publicProcedure
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
