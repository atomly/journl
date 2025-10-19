import { db } from "@acme/db/client";
import { Plan, type Subscription, UsagePeriod } from "@acme/db/schema";
import { and, eq, gte, isNull } from "drizzle-orm";

function get30DayPeriod(startDate: Date = new Date()) {
  const periodStart = new Date(startDate);
  const periodEnd = new Date(startDate);
  periodEnd.setDate(periodEnd.getDate() + 30);
  periodEnd.setMilliseconds(periodEnd.getMilliseconds() - 1);
  return { periodEnd, periodStart };
}

export async function createInitialUsagePeriodForUser(userId: string) {
  const freePlan = await db.query.Plan.findFirst({
    where: eq(Plan.name, "free"),
  });

  if (!freePlan) {
    console.error("No free plan found, cannot create usage period for user");
    return;
  }

  const { periodStart, periodEnd } = get30DayPeriod();

  await db
    .insert(UsagePeriod)
    .values({
      period_end: periodEnd,
      period_start: periodStart,
      plan_id: freePlan.id,
      subscription_id: null,
      user_id: userId,
    })
    .onConflictDoNothing({
      target: [
        UsagePeriod.user_id,
        UsagePeriod.period_start,
        UsagePeriod.period_end,
      ],
    });
}

export async function createUsagePeriodForSubscription(
  subscription: Subscription,
) {
  if (!subscription.referenceId) {
    console.error(
      "Subscription missing referenceId (userId), cannot create usage period",
    );
    return;
  }

  if (!subscription.periodStart || !subscription.periodEnd) {
    console.error(
      "Subscription missing period dates, cannot create usage period",
    );
    return;
  }

  if (!subscription.planName) {
    console.error("Subscription missing planName, cannot create usage period");
    return;
  }

  const plan = await db.query.Plan.findFirst({
    where: eq(Plan.name, subscription.planName),
  });

  if (!plan) {
    console.error(
      `Plan ${subscription.planName} not found, cannot create usage period`,
    );
    return;
  }

  // Handle free-to-pro upgrades: trim overlapping free periods
  // Example: User on free (Jan 1-31), upgrades Jan 20
  // Result: Free period (Jan 1-19), Pro period (Jan 20-Feb 20)
  const overlappingPeriods = await db.query.UsagePeriod.findMany({
    where: and(
      eq(UsagePeriod.user_id, subscription.referenceId),
      isNull(UsagePeriod.subscription_id),
      gte(UsagePeriod.period_end, subscription.periodStart),
    ),
  });

  // Trim each overlapping free period to end 1ms before pro period starts
  // Preserves usage data and aggregates tied to the free period
  for (const period of overlappingPeriods) {
    const newEndDate = new Date(subscription.periodStart.getTime() - 1);
    await db
      .update(UsagePeriod)
      .set({
        period_end: newEndDate,
      })
      .where(eq(UsagePeriod.id, period.id));
  }

  // Create new pro period linked to subscription
  await db
    .insert(UsagePeriod)
    .values({
      period_end: subscription.periodEnd,
      period_start: subscription.periodStart,
      plan_id: plan.id,
      subscription_id: subscription.id,
      user_id: subscription.referenceId,
    })
    .onConflictDoNothing({
      target: [
        UsagePeriod.user_id,
        UsagePeriod.period_start,
        UsagePeriod.period_end,
      ],
    });
}
