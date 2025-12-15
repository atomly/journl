import { and, desc, eq, lte, sql } from "@acme/db";
import {
  ModelPricing,
  Plan,
  Subscription,
  UsageAggregate,
  UsageEvent,
  UsageEventStatus,
  UsagePeriod,
} from "@acme/db/schema";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { gte, or } from "drizzle-orm";
import { z } from "zod/v4";
import type { TRPCContext } from "../trpc.js";
import { publicProcedure } from "../trpc.js";

type DbInstance = TRPCContext["db"];

function getPeriodConflictTarget() {
  return [
    UsagePeriod.user_id,
    UsagePeriod.period_start,
    UsagePeriod.period_end,
  ];
}

const PERIOD_WITH_RELATIONS = {
  plan: true,
  subscription: {
    with: {
      plan: true,
    },
  },
  usageAggregate: true,
} as const;

function calculate30DayPeriod(startDate: Date = new Date()) {
  const start = new Date(startDate);
  const end = new Date(startDate);
  end.setDate(end.getDate() + 30);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return { end: end.toISOString(), start: start.toISOString() };
}

function findUsagePeriodForDate(db: DbInstance, userId: string, date: string) {
  return db.query.UsagePeriod.findFirst({
    orderBy: (fields, { desc }) => [
      desc(fields.subscription_id),
      desc(fields.created_at),
    ],
    where: and(
      eq(UsagePeriod.user_id, userId),
      lte(UsagePeriod.period_start, date),
      gte(UsagePeriod.period_end, date),
    ),
    with: PERIOD_WITH_RELATIONS,
  });
}

function findActiveUsagePeriod(db: DbInstance, userId: string) {
  return findUsagePeriodForDate(db, userId, new Date().toISOString());
}

function findActiveSubscription(db: DbInstance, userId: string) {
  return db.query.Subscription.findFirst({
    where: and(
      eq(Subscription.referenceId, userId),
      or(
        eq(Subscription.status, "active"),
        eq(Subscription.status, "trialing"),
      ),
    ),
  });
}

function findPeriodByDates(
  db: DbInstance,
  userId: string,
  periodStart: string,
  periodEnd: string,
) {
  return db.query.UsagePeriod.findFirst({
    where: and(
      eq(UsagePeriod.user_id, userId),
      eq(UsagePeriod.period_start, periodStart),
      eq(UsagePeriod.period_end, periodEnd),
    ),
    with: PERIOD_WITH_RELATIONS,
  });
}

async function createFreePeriod(
  db: DbInstance,
  userId: string,
  startDate?: Date,
) {
  const freePlan = await db.query.Plan.findFirst({
    where: eq(Plan.name, "free"),
  });

  if (!freePlan) {
    throw new Error("No free plan found");
  }

  const { end, start } = calculate30DayPeriod(startDate);

  await db
    .insert(UsagePeriod)
    .values({
      period_end: end,
      period_start: start,
      plan_id: freePlan.id,
      subscription_id: null,
      user_id: userId,
    })
    .onConflictDoNothing({
      target: getPeriodConflictTarget(),
    });
}

async function createProPeriod(db: DbInstance, subscription: Subscription) {
  if (
    !subscription.id ||
    !subscription.referenceId ||
    !subscription.periodStart ||
    !subscription.periodEnd ||
    !subscription.planName
  ) {
    throw new Error("Invalid subscription data");
  }

  const plan = await db.query.Plan.findFirst({
    where: eq(Plan.name, subscription.planName),
  });

  if (!plan) {
    throw new Error(`Plan ${subscription.planName} not found`);
  }

  const startISO = subscription.periodStart.toISOString();
  const endISO = subscription.periodEnd.toISOString();

  const existingPeriod = await findPeriodByDates(
    db,
    subscription.referenceId,
    startISO,
    endISO,
  );

  if (existingPeriod) {
    return existingPeriod;
  }

  await db
    .insert(UsagePeriod)
    .values({
      period_end: endISO,
      period_start: startISO,
      plan_id: plan.id,
      subscription_id: subscription.id,
      user_id: subscription.referenceId,
    })
    .onConflictDoNothing({
      target: getPeriodConflictTarget(),
    });

  const period = await findPeriodByDates(
    db,
    subscription.referenceId,
    startISO,
    endISO,
  );

  if (!period) {
    throw new Error("Failed to create pro usage period");
  }

  return period;
}

export async function getUsagePeriod(db: DbInstance, userId: string) {
  return await findActiveUsagePeriod(db, userId);
}

export async function createUsagePeriod(db: DbInstance, userId: string) {
  const activeSubscription = await findActiveSubscription(db, userId);

  if (activeSubscription) {
    return await createProPeriod(db, activeSubscription);
  }

  await createFreePeriod(db, userId);
  const period = await findActiveUsagePeriod(db, userId);
  if (!period) {
    throw new Error(`Failed to create usage period for user ${userId}`);
  }
  return period;
}

export const usageRouter = {
  checkUsage: publicProcedure
    .input(z.object({ user_id: z.string() }))
    .query(async ({ ctx, input }) => {
      let period = await getUsagePeriod(ctx.db, input.user_id);

      if (!period) {
        period = await createUsagePeriod(ctx.db, input.user_id);
      }

      if (!period.plan) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Usage period missing plan data",
        });
      }

      const quotaUsd = period.plan.quota / 100;
      const currentUsageUsd = period.usageAggregate
        ? Number.parseFloat(period.usageAggregate.total_cost)
        : 0;
      const remainingQuotaUsd = Math.max(0, quotaUsd - currentUsageUsd);

      return {
        canUse: currentUsageUsd < quotaUsd,
        currentUsageUsd,
        quotaUsd,
        remainingQuotaUsd,
        subscriptionType: period.subscription ? "pro" : "free",
        usagePeriodId: period.id,
      };
    }),
  getCurrentUsagePeriod: publicProcedure
    .input(z.object({ user_id: z.string() }))
    .query(async ({ ctx, input }) => {
      return await getUsagePeriod(ctx.db, input.user_id);
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
        const event = await tx.query.UsageEvent.findFirst({
          where: eq(UsageEvent.id, input.usage_event_id),
        });

        if (!event) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Usage event not found",
          });
        }

        if (event.status === "processed") {
          return { message: "Already processed", success: true };
        }

        const eventDate = event.created_at ?? new Date().toISOString();
        let period = await findUsagePeriodForDate(tx, input.user_id, eventDate);

        if (!period) {
          const activeSubscription = await findActiveSubscription(
            tx,
            input.user_id,
          );

          if (activeSubscription) {
            try {
              await createProPeriod(tx, activeSubscription);
            } catch (error) {
              console.error("Failed to create pro period:", error);
            }
          }

          period = await findUsagePeriodForDate(tx, input.user_id, eventDate);

          if (!period) {
            await createFreePeriod(tx, input.user_id, new Date(eventDate));
            period = await findUsagePeriodForDate(tx, input.user_id, eventDate);
          }

          if (!period) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `No usage period found for event date ${eventDate}`,
            });
          }
        }

        const pricingRecords = await tx
          .select()
          .from(ModelPricing)
          .where(
            and(
              eq(ModelPricing.model_id, event.model_id),
              eq(ModelPricing.model_provider, event.model_provider),
              lte(ModelPricing.effective_date, eventDate),
            ),
          )
          .orderBy(desc(ModelPricing.effective_date));

        const pricingByUnit = new Map<string, (typeof pricingRecords)[0]>();
        for (const price of pricingRecords) {
          if (!pricingByUnit.has(price.unit_type)) {
            pricingByUnit.set(price.unit_type, price);
          }
        }

        let totalCost = 0;
        for (const metric of event.metrics) {
          const price = pricingByUnit.get(metric.unit);
          if (price) {
            totalCost +=
              Number.parseFloat(price.price_per_unit) * metric.quantity;
          } else {
            console.warn(
              `No pricing for model ${event.model_id} (${event.model_provider}) unit ${metric.unit}`,
            );
          }
        }

        const costString = totalCost.toFixed(6);

        await tx
          .insert(UsageAggregate)
          .values({
            total_cost: costString,
            usage_period_id: period.id,
            user_id: event.user_id,
          })
          .onConflictDoUpdate({
            set: {
              total_cost: sql`${UsageAggregate.total_cost} + ${costString}`,
            },
            target: [UsageAggregate.user_id, UsageAggregate.usage_period_id],
          });

        await tx
          .update(UsageEvent)
          .set({
            status: "processed",
            total_cost: costString,
          })
          .where(eq(UsageEvent.id, input.usage_event_id));

        return {
          cost_added: totalCost,
          success: true,
          usage_period_id: period.id,
        };
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
      return await ctx.db.insert(UsageEvent).values(input);
    }),
  updateUsageEventStatus: publicProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(UsageEventStatus.enumValues),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db
        .update(UsageEvent)
        .set({ status: input.status })
        .where(eq(UsageEvent.id, input.id));
    }),
} satisfies TRPCRouterRecord;
