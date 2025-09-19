import { stripePrice } from "@acme/db/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { protectedProcedure, type TRPCContext } from "../trpc";

/**
 * Create headers with only the cookie header needed for authentication
 */
const getAuthHeaders = (headers: Headers): Headers => {
  const authHeaders = new Headers();
  const cookieHeader = headers.get("cookie");

  if (cookieHeader) {
    authHeaders.set("cookie", cookieHeader);
  }

  return authHeaders;
};

const getActiveSubscription = async ({ ctx }: { ctx: TRPCContext }) => {
  const subscriptions = await ctx.authApi.listActiveSubscriptions({
    headers: getAuthHeaders(ctx.headers),
    query: {
      referenceId: ctx.session?.user.id,
    },
  });
  return subscriptions.find(
    (sub) => sub.status === "active" || sub.status === "trialing",
  );
};

export const subscriptionRouter = {
  getActivePlan: protectedProcedure.query(async ({ ctx }) => {
    const activeSubscription = await getActiveSubscription({ ctx });
    if (!activeSubscription?.priceId) return null;

    const price = await ctx.db.query.stripePrice.findFirst({
      where: eq(stripePrice.id, activeSubscription.priceId),
      with: {
        product: true,
      },
    });

    return price;
  }),
  getActiveSubscription: protectedProcedure.query(async ({ ctx }) => {
    const activeSubscription = await getActiveSubscription({ ctx });
    return activeSubscription;
  }),
  getProPlan: protectedProcedure.query(async ({ ctx }) => {
    // Find the pro plan by name or metadata
    const proProduct = await ctx.db.query.stripeProduct.findFirst({
      where: (products, { ilike, eq }) =>
        eq(products.active, true) && ilike(products.name, "%pro%"),
      with: {
        prices: {
          where: eq(stripePrice.active, true),
        },
      },
    });

    if (!proProduct || !proProduct.prices.length) {
      return null;
    }

    const price = proProduct.prices[0]; // Take the first active price

    return {
      description: proProduct.description,
      id: proProduct.id,
      name: proProduct.name,
      price: price?.unit_amount || 0,
      priceId: price?.id || "",
      quota: z.coerce.number().parse(price?.metadata?.quota || "0"),
    };
  }),
  openBillingPortal: protectedProcedure
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
