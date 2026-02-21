import { and, eq, gte, lte } from "drizzle-orm";
import type { DbTransaction } from "../client.ts";
import { Plan, type Subscription, UsagePeriod } from "../schema.ts";
import {
  calculate30DayPeriod,
  findActiveSubscription,
  getUsagePeriodConflictTarget,
} from "./usage-period.ts";
import { getPeriodUsageQuota, type UsageQuota } from "./usage-policy.ts";

type DbInstance = typeof import("../client.ts").db | DbTransaction;

const PERIOD_WITH_RELATIONS = {
  plan: true,
  subscription: {
    with: {
      plan: true,
    },
  },
  usageAggregate: true,
} as const;

export class UsageLimitError extends Error {
  readonly quotaStatus: UsageQuota;
  readonly status: UsageQuota;

  constructor(status: UsageQuota) {
    super("Usage quota exceeded");
    this.name = "UsageLimitError";
    this.quotaStatus = status;
    this.status = status;
  }
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

function subscriptionCoversDate(subscription: Subscription, date: string) {
  if (!subscription.periodStart || !subscription.periodEnd) {
    return false;
  }

  const timestamp = new Date(date).getTime();
  return (
    timestamp >= subscription.periodStart.getTime() &&
    timestamp <= subscription.periodEnd.getTime()
  );
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

  const period = await findPeriodByDates(db, userId, start, end);

  if (!period) {
    throw new Error(`Failed to create usage period for user ${userId}`);
  }

  return period;
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
  return await findUsagePeriodForDate(db, userId, new Date().toISOString());
}

export async function getUsagePeriodAtDate(
  db: DbInstance,
  userId: string,
  date: string,
) {
  return await findUsagePeriodForDate(db, userId, date);
}

export async function ensureUsagePeriodAtDate(
  db: DbInstance,
  userId: string,
  date: string,
) {
  const existingPeriod = await getUsagePeriodAtDate(db, userId, date);

  if (existingPeriod) {
    return existingPeriod;
  }

  const activeSubscription = await findActiveSubscription(db, userId);

  if (activeSubscription && subscriptionCoversDate(activeSubscription, date)) {
    return await createProPeriod(db, activeSubscription);
  }

  return await createFreePeriod(db, userId, new Date(date));
}

export async function ensureUsagePeriod(db: DbInstance, userId: string) {
  return await ensureUsagePeriodAtDate(db, userId, new Date().toISOString());
}

async function getPlanByName(db: DbInstance, planName: string) {
  return await db.query.Plan.findFirst({
    where: eq(Plan.name, planName),
  });
}

export async function getUsageQuota(
  db: DbInstance,
  userId: string,
): Promise<UsageQuota> {
  // Read-only path by design: quota checks must not create usage records.
  const period = await getUsagePeriod(db, userId);

  if (period) {
    return getPeriodUsageQuota(period);
  }

  const activeSubscription = await findActiveSubscription(db, userId);

  if (activeSubscription?.planName) {
    const subscriptionPlan = await getPlanByName(
      db,
      activeSubscription.planName,
    );

    if (!subscriptionPlan) {
      throw new Error(`Plan ${activeSubscription.planName} not found`);
    }

    return getPeriodUsageQuota({
      id: null,
      plan: {
        quota: subscriptionPlan.quota,
      },
      subscription: {
        id: activeSubscription.id ?? undefined,
      },
      usageAggregate: null,
    });
  }

  const freePlan = await getPlanByName(db, "free");

  if (!freePlan) {
    throw new Error("No free plan found");
  }

  return getPeriodUsageQuota({
    id: null,
    plan: {
      quota: freePlan.quota,
    },
    subscription: null,
    usageAggregate: null,
  });
}

export async function assertUsageQuota(db: DbInstance, userId: string) {
  // Assertion is also read-only; this is used by query guards.
  const status = await getUsageQuota(db, userId);

  if (!status.canUse) {
    throw new UsageLimitError(status);
  }

  return status;
}
