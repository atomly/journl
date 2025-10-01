import { and, eq, or } from "@acme/db";
import { Subscription } from "@acme/db/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";
import type { TRPCContext } from "../trpc";
import { protectedProcedure } from "../trpc";

/**
 * Create headers with only the cookie header needed for authentication
 */
function getAuthHeaders(headers: Headers): Headers {
  const authHeaders = new Headers();
  const cookieHeader = headers.get("cookie");

  if (cookieHeader) {
    authHeaders.set("cookie", cookieHeader);
  }

  return authHeaders;
}

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

const zProPlan = z.object({
  description: z.string().nullable(),
  displayName: z.string(),
  id: z.string(),
  name: z.string(),
  price: z.number(),
  quota: z.number(),
});

export const subscriptionRouter = {
  createBillingPortal: protectedProcedure
    .input(
      z.object({
        returnUrl: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.authApi.createBillingPortal({
        body: {
          locale: "en",
          referenceId: ctx.session.user.id,
          returnUrl: input.returnUrl,
        },
        headers: getAuthHeaders(ctx.headers),
      });
    }),
  getProPlan: protectedProcedure.query(async ({ ctx }) => {
    const plan = await ctx.db.query.Plan.findFirst({
      where: (products, { ilike, eq }) =>
        eq(products.active, true) && ilike(products.name, "%pro%"),
      with: {
        price: true,
      },
    });

    if (!plan || !plan.price) {
      return null;
    }

    return zProPlan.parse({
      description: plan.description,
      displayName: plan.displayName,
      id: plan.id,
      name: plan.name,
      price: plan.price.unitAmount,
      quota: plan.quota,
    });
  }),
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const subscription = await getActiveSubscription({ ctx });

    if (!subscription?.plan) {
      return null;
    }

    return {
      ...subscription,
      plan: subscription.plan,
    };
  }),
  upgradeSubscription: protectedProcedure
    .input(
      z.object({
        annual: z.boolean().optional(),
        cancelUrl: z.string(),
        disableRedirect: z.boolean().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
        plan: z.string(),
        referenceId: z.string().optional(),
        returnUrl: z.string(),
        seats: z.number().optional(),
        subscriptionId: z.string().optional(),
        successUrl: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.authApi.upgradeSubscription({
        body: {
          annual: input.annual,
          cancelUrl: input.cancelUrl,
          disableRedirect: input.disableRedirect,
          metadata: input.metadata,
          plan: input.plan,
          referenceId: input.referenceId ?? ctx.session.user.id,
          returnUrl: input.returnUrl,
          seats: input.seats,
          subscriptionId: input.subscriptionId,
          successUrl: input.successUrl,
        },
        headers: getAuthHeaders(ctx.headers),
      });
    }),
} satisfies TRPCRouterRecord;
