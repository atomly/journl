import { and, eq, or } from "@acme/db";
import { Subscription } from "@acme/db/schema";
import type { TRPCContext } from "../trpc";

/**
 * Get the free plan from the database
 */
export async function getFreePlan(ctx: TRPCContext) {
  return ctx.db.query.Plan.findFirst({
    where: (plans, { eq, and }) =>
      and(eq(plans.active, true), eq(plans.name, "free")),
  });
}

/**
 * Get the active subscription for a user
 */
export async function getActiveSubscription({
  ctx,
  userId,
}: {
  ctx: TRPCContext;
  userId?: string;
}) {
  const userIdToUse = userId ?? ctx.session?.user?.id;

  if (!userIdToUse) {
    return null;
  }

  return ctx.db.query.Subscription.findFirst({
    where: and(
      eq(Subscription.referenceId, userIdToUse),
      or(
        eq(Subscription.status, "active"),
        eq(Subscription.status, "trialing"),
      ),
    ),
    with: {
      plan: {
        with: {
          price: true,
        },
      },
    },
  });
}
