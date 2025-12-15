import type { DbTransaction } from "@acme/db/client";
import { db } from "@acme/db/client";
import { Plan, type Subscription, UsagePeriod } from "@acme/db/schema";
import { and, eq, gte, isNull } from "drizzle-orm";

type DbInstance = typeof import("@acme/db/client").db | DbTransaction;

function getPeriodConflictTarget() {
  return [
    UsagePeriod.user_id,
    UsagePeriod.period_start,
    UsagePeriod.period_end,
  ];
}

function get30DayPeriod(startDate: Date = new Date()) {
  const periodStart = new Date(startDate);
  const periodEnd = new Date(startDate);
  periodEnd.setDate(periodEnd.getDate() + 30);
  periodEnd.setMilliseconds(periodEnd.getMilliseconds() - 1);
  return { periodEnd, periodStart };
}

async function trimOverlappingFreePeriods({
  db,
  userId,
  proPeriodStart,
}: {
  db: DbInstance;
  userId: string;
  proPeriodStart: Date;
}) {
  const overlappingPeriods = await db.query.UsagePeriod.findMany({
    where: and(
      eq(UsagePeriod.user_id, userId),
      isNull(UsagePeriod.subscription_id),
      gte(UsagePeriod.period_end, proPeriodStart.toISOString()),
    ),
  });

  for (const period of overlappingPeriods) {
    const newEndDate = new Date(proPeriodStart.getTime() - 1);
    await db
      .update(UsagePeriod)
      .set({
        period_end: newEndDate.toISOString(),
      })
      .where(eq(UsagePeriod.id, period.id));
  }
}

export async function createFreeUsagePeriod({
  db,
  userId,
  startDate,
}: {
  db: DbInstance;
  userId: string;
  startDate?: Date;
}) {
  const freePlan = await db.query.Plan.findFirst({
    where: eq(Plan.name, "free"),
  });

  if (!freePlan) {
    throw new Error("No free plan found");
  }

  const { periodStart, periodEnd } = get30DayPeriod(startDate);

  await db
    .insert(UsagePeriod)
    .values({
      period_end: periodEnd.toISOString(),
      period_start: periodStart.toISOString(),
      plan_id: freePlan.id,
      subscription_id: null,
      user_id: userId,
    })
    .onConflictDoNothing({
      target: getPeriodConflictTarget(),
    });
}

export async function createProUsagePeriod({
  db,
  subscription,
  trimOverlapping = true,
}: {
  db: DbInstance;
  subscription: Subscription;
  trimOverlapping?: boolean;
}) {
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

  if (trimOverlapping) {
    await trimOverlappingFreePeriods({
      db,
      proPeriodStart: subscription.periodStart,
      userId: subscription.referenceId,
    });
  }

  await db
    .insert(UsagePeriod)
    .values({
      period_end: subscription.periodEnd.toISOString(),
      period_start: subscription.periodStart.toISOString(),
      plan_id: plan.id,
      subscription_id: subscription.id,
      user_id: subscription.referenceId,
    })
    .onConflictDoNothing({
      target: getPeriodConflictTarget(),
    });
}

export async function createInitialUsagePeriodForUser(userId: string) {
  await createFreeUsagePeriod({ db, userId });
}

export async function createUsagePeriodForSubscription(
  subscription: Subscription,
) {
  await createProUsagePeriod({ db, subscription, trimOverlapping: true });
}
