import { and, eq, lte } from "@acme/db";
import { Plan, type Subscription, UsagePeriod } from "@acme/db/schema";
import {
  calculate30DayPeriod,
  findActiveSubscription,
  getUsagePeriodConflictTarget,
} from "@acme/db/utils";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { gte } from "drizzle-orm";
import { z } from "zod/v4";
import type { TRPCContext } from "../trpc.js";
import { publicProcedure } from "../trpc.js";

type DbInstance = TRPCContext["db"];

const PERIOD_WITH_RELATIONS = {
  plan: true,
  subscription: {
    with: {
      plan: true,
    },
  },
  usageAggregate: true,
} as const;

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
      target: getUsagePeriodConflictTarget(),
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
      target: getUsagePeriodConflictTarget(),
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
} satisfies TRPCRouterRecord;
