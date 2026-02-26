import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";
import { getActiveSubscription } from "../shared/subscription";
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
    let subscription = null;

    try {
      subscription = await getActiveSubscription({ ctx });
    } catch (error) {
      console.error("Failed to load active subscription", {
        error,
        userId: ctx.session.user.id,
      });
      return null;
    }

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
