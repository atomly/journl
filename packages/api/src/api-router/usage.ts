import { and, desc, eq, lte, sql } from "@acme/db";
import {
  ModelPricing,
  UsageAggregate,
  UsageEvent,
  UsageEventStatus,
  UsagePeriod,
} from "@acme/db/schema";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";
import type { TRPCContext } from "../trpc.js";
import { publicProcedure } from "../trpc.js";
import { getActiveSubscription } from "./subscription.js";

/**
 * Get the free plan from the database
 */
async function getFreePlan(ctx: TRPCContext) {
  return ctx.db.query.Plan.findFirst({
    where: (plans, { eq, and }) =>
      and(
        eq(plans.active, true),
        eq(plans.name, "free"), // Exact match for "free" plan name
      ),
  });
}

/**
 * Get or create the current usage period for a user
 */
async function getCurrentUsagePeriod({
  ctx,
  userId,
}: {
  ctx: TRPCContext;
  userId: string;
}) {
  // First, check if user has an active subscription
  const activeSubscription = await getActiveSubscription({
    ctx,
    userId,
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
        eq(UsagePeriod.user_id, userId),
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
          user_id: userId,
        })
        .returning();

      usagePeriod = newUsagePeriod;
    }

    if (!usagePeriod) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create or retrieve usage period for subscription",
      });
    }

    return usagePeriod;
  } else {
    // For free users, we will use a monthly usage period (1st of each month) for simplicity
    const now = new Date();
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
        eq(UsagePeriod.user_id, userId),
        eq(UsagePeriod.period_start, monthStart),
        eq(UsagePeriod.period_end, monthEnd),
      ),
    });

    if (!usagePeriod) {
      // Get the free plan for free users
      const freePlan = await getFreePlan(ctx);

      // Create usage period for free user
      const [newUsagePeriod] = await ctx.db
        .insert(UsagePeriod)
        .values({
          period_end: monthEnd,
          period_start: monthStart,
          plan_id: freePlan?.id || null, // Use free plan ID if found
          subscription_id: null, // Free users don't have a subscription_id
          user_id: userId,
        })
        .returning();

      usagePeriod = newUsagePeriod;
    }

    if (!usagePeriod) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create or retrieve usage period for free user",
      });
    }

    return usagePeriod;
  }
}

export const usageRouter = {
  checkUsage: publicProcedure
    .input(z.object({ user_id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        // Get active subscription
        const activeSubscription = await getActiveSubscription({
          ctx,
          userId: input.user_id,
        });

        // Get current usage period (creates one if it doesn't exist)
        const usagePeriod = await getCurrentUsagePeriod({
          ctx,
          userId: input.user_id,
        });

        // Determine quota based on subscription status
        let quotaUsd: number;
        if (activeSubscription?.plan) {
          // Pro user: use plan quota
          quotaUsd = activeSubscription.plan.quota / 100;
        } else {
          // Free user: get quota from free plan
          const freePlan = await getFreePlan(ctx);
          if (!freePlan) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "No free plan found",
            });
          }
          quotaUsd = freePlan.quota / 100; // Convert cents to dollars
        }

        // Get current usage for the period
        let currentUsageUsd = 0;
        const usageAggregate = await ctx.db.query.UsageAggregate.findFirst({
          where: and(
            eq(UsageAggregate.user_id, input.user_id),
            eq(UsageAggregate.usage_period_id, usagePeriod.id),
          ),
        });

        if (usageAggregate) {
          currentUsageUsd = Number.parseFloat(usageAggregate.total_cost_usd);
        }

        const canUse = currentUsageUsd < quotaUsd;
        const remainingQuotaUsd = quotaUsd - currentUsageUsd;

        return {
          canUse,
          currentUsageUsd,
          quotaUsd,
          remainingQuotaUsd: Math.max(0, remainingQuotaUsd),
          subscriptionType: activeSubscription ? "pro" : "free",
          usagePeriodId: usagePeriod.id,
        };
      } catch (error) {
        console.error("Error checking usage:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to check usage",
        });
      }
    }),
  getCurrentUsagePeriod: publicProcedure
    .input(z.object({ user_id: z.string() }))
    .query(async ({ ctx, input }) => {
      return getCurrentUsagePeriod({
        ctx,
        userId: input.user_id,
      });
    }),
  processUsageEvent: publicProcedure
    .input(
      z.object({
        usage_event_id: z.string(),
        user_id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Get the usage event
        const usageEvent = await ctx.db.query.UsageEvent.findFirst({
          where: eq(UsageEvent.id, input.usage_event_id),
        });

        if (!usageEvent) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Usage event not found",
          });
        }

        if (usageEvent.status === "processed") {
          return { message: "Already processed", success: true };
        }

        // Get or create the current usage period
        const usagePeriod = await getCurrentUsagePeriod({
          ctx,
          userId: input.user_id,
        });

        // Calculate total cost for this usage event
        let totalCost = 0;

        for (const metric of usageEvent.metrics) {
          // Get current pricing for this model and unit type
          const eventDate = usageEvent.created_at
            ? new Date(usageEvent.created_at)
            : new Date();
          const pricing = await ctx.db
            .select()
            .from(ModelPricing)
            .where(
              and(
                eq(ModelPricing.model_id, usageEvent.model_id),
                eq(ModelPricing.model_provider, usageEvent.model_provider),
                eq(ModelPricing.unit_type, metric.unit),
                lte(ModelPricing.effective_date, eventDate),
              ),
            )
            .orderBy(desc(ModelPricing.effective_date))
            .limit(1)
            .then((results) => results[0] || null);

          if (pricing) {
            const cost =
              Number.parseFloat(pricing.price_per_unit_usd) * metric.quantity;
            totalCost += cost;
          } else {
            console.warn(
              `No pricing found for model ${usageEvent.model_id} (${usageEvent.model_provider}) unit ${metric.unit}`,
            );
          }
        }

        // Update or create usage aggregate
        await ctx.db
          .insert(UsageAggregate)
          .values({
            total_cost_usd: totalCost.toFixed(6),
            usage_period_id: usagePeriod.id,
            user_id: usageEvent.user_id,
          })
          .onConflictDoUpdate({
            set: {
              total_cost_usd: sql`${UsageAggregate.total_cost_usd} + ${totalCost.toFixed(6)}`,
              updated_at: new Date(),
            },
            target: [UsageAggregate.user_id, UsageAggregate.usage_period_id],
          });

        // Mark usage event as processed and store the calculated cost
        await ctx.db
          .update(UsageEvent)
          .set({
            status: "processed",
            total_cost_usd: totalCost.toFixed(6),
          })
          .where(eq(UsageEvent.id, input.usage_event_id));

        return {
          cost_added: totalCost,
          success: true,
          usage_period_id: usagePeriod.id,
        };
      } catch (error) {
        console.error("Database error in usage.processUsageEvent:", error);

        // Mark usage event as failed
        await ctx.db
          .update(UsageEvent)
          .set({ status: "failed" })
          .where(eq(UsageEvent.id, input.usage_event_id));

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to process usage event",
        });
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
