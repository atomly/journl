import { and, eq, or } from "drizzle-orm";
import type { DbTransaction } from "../client.js";
import { Subscription, UsagePeriod } from "../schema.js";

type DbInstance = typeof import("../client.js").db | DbTransaction;

export function getUsagePeriodConflictTarget() {
  return [
    UsagePeriod.user_id,
    UsagePeriod.period_start,
    UsagePeriod.period_end,
  ];
}

export function calculate30DayPeriod(startDate: Date = new Date()) {
  const start = new Date(startDate);
  const end = new Date(startDate);
  end.setDate(end.getDate() + 30);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return { end: end.toISOString(), start: start.toISOString() };
}

export function findActiveSubscription(db: DbInstance, userId: string) {
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
