import { and, desc, eq, lte, sql } from "@acme/db";
import {
  ModelPricing,
  UsageAggregate,
  UsageEvent,
  UsageEventStatus,
  UsagePeriod,
} from "@acme/db/schema";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { gte } from "drizzle-orm";
import { z } from "zod/v4";
import type { TRPCContext } from "../trpc.js";
import { publicProcedure } from "../trpc.js";

/**
 * Get the current usage period aggregate for a user
 * Returns a complete aggregate with period, plan, and subscription data
 * Periods are created by webhooks (pro) and cron jobs (free)
 */
async function getCurrentUsagePeriod({
  ctx,
  userId,
}: {
  ctx: TRPCContext;
  userId: string;
}) {
  const now = new Date().toISOString();

  const usagePeriodAggregate = await ctx.db.query.UsagePeriod.findFirst({
    orderBy: (fields, { desc }) => [
      desc(fields.subscription_id),
      desc(fields.created_at),
    ],
    where: and(
      eq(UsagePeriod.user_id, userId),
      lte(UsagePeriod.period_start, now),
      gte(UsagePeriod.period_end, now),
    ),
    with: {
      plan: true,
      subscription: {
        with: {
          plan: true,
        },
      },
      usageAggregate: true,
    },
  });

  if (!usagePeriodAggregate) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "No active usage period found. Usage periods are created automatically via webhooks and scheduled jobs.",
    });
  }

  return usagePeriodAggregate;
}

export const usageRouter = {
  checkUsage: publicProcedure
    .input(z.object({ user_id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const usagePeriodAggregate = await getCurrentUsagePeriod({
          ctx,
          userId: input.user_id,
        });

        const { plan } = usagePeriodAggregate;
        if (!plan) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Usage period missing plan data",
          });
        }

        const quotaUsd = plan.quota / 100;

        const currentUsageUsd = usagePeriodAggregate.usageAggregate
          ? Number.parseFloat(usagePeriodAggregate.usageAggregate.total_cost)
          : 0;

        const canUse = currentUsageUsd < quotaUsd;
        const remainingQuotaUsd = quotaUsd - currentUsageUsd;

        return {
          canUse,
          currentUsageUsd,
          quotaUsd,
          remainingQuotaUsd: Math.max(0, remainingQuotaUsd),
          subscriptionType: usagePeriodAggregate.subscription ? "pro" : "free",
          usagePeriodId: usagePeriodAggregate.id,
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
      return await ctx.db.transaction(async (tx) => {
        try {
          // Get the usage event
          const usageEvent = await tx.query.UsageEvent.findFirst({
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

          const usagePeriod = await getCurrentUsagePeriod({
            ctx,
            userId: input.user_id,
          });

          const eventDate = usageEvent.created_at
            ? usageEvent.created_at
            : new Date().toISOString();

          // Fetch all pricing for this model upfront
          const allPricing = await tx
            .select()
            .from(ModelPricing)
            .where(
              and(
                eq(ModelPricing.model_id, usageEvent.model_id),
                eq(ModelPricing.model_provider, usageEvent.model_provider),
                lte(ModelPricing.effective_date, eventDate),
              ),
            )
            .orderBy(desc(ModelPricing.effective_date));

          // Create lookup map
          const pricingMap = new Map<string, (typeof allPricing)[0]>();
          for (const price of allPricing) {
            if (!pricingMap.has(price.unit_type)) {
              pricingMap.set(price.unit_type, price);
            }
          }

          // Calculate total cost using in-memory pricing lookups
          let totalCost = 0;
          for (const metric of usageEvent.metrics) {
            const pricing = pricingMap.get(metric.unit);

            if (pricing) {
              const cost =
                Number.parseFloat(pricing.price_per_unit) * metric.quantity;
              totalCost += cost;
            } else {
              console.warn(
                `No pricing found for model ${usageEvent.model_id} (${usageEvent.model_provider}) unit ${metric.unit}`,
              );
            }
          }

          // Update or create usage aggregate
          await tx
            .insert(UsageAggregate)
            .values({
              total_cost: totalCost.toFixed(6),
              usage_period_id: usagePeriod.id,
              user_id: usageEvent.user_id,
            })
            .onConflictDoUpdate({
              set: {
                total_cost: sql`${UsageAggregate.total_cost} + ${totalCost.toFixed(6)}`,
              },
              target: [UsageAggregate.user_id, UsageAggregate.usage_period_id],
            });

          // Mark usage event as processed and store the calculated cost
          await tx
            .update(UsageEvent)
            .set({
              status: "processed",
              total_cost: totalCost.toFixed(6),
            })
            .where(eq(UsageEvent.id, input.usage_event_id));

          return {
            cost_added: totalCost,
            success: true,
            usage_period_id: usagePeriod.id,
          };
        } catch (error) {
          console.error("Database error in usage.processUsageEvent:", error);

          // Mark usage event as failed within the transaction
          await tx
            .update(UsageEvent)
            .set({ status: "failed" })
            .where(eq(UsageEvent.id, input.usage_event_id));

          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to process usage event",
          });
        }
      });
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
