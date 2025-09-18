import type { TRPCRouterRecord } from "@trpc/server";
import Stripe from "stripe";
import { z } from "zod/v4";
import { env } from "../env";
import { protectedProcedure, type TRPCContext } from "../trpc";

const stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-08-27.basil",
  typescript: true,
});

const getActiveSubscription = async ({ ctx }: { ctx: TRPCContext }) => {
  const subscriptions = await ctx.authApi.listActiveSubscriptions({
    headers: ctx.headers,
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
    const prices = await stripeClient.prices.list({
      limit: 3,
    });
    return prices.data.find(
      (price) => price.id === activeSubscription?.priceId,
    );
  }),
  getActiveSubscription: protectedProcedure.query(async ({ ctx }) => {
    const activeSubscription = await getActiveSubscription({ ctx });
    return activeSubscription;
  }),
  getAvailablePlans: protectedProcedure.query(async () => {
    const products = await stripeClient.products.list({
      active: true,
      expand: ["data.default_price"],
    });

    const prices = await stripeClient.prices.list({
      limit: 3,
    });

    return products.data.map((product) => {
      const price = prices.data.find((price) => price.product === product.id);
      return {
        description: product.description,
        id: product.id,
        name: product.name,
        price: price?.unit_amount,
        priceId: price?.id,
        quota: price?.metadata.quota as unknown as number,
      };
    });
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
        headers: ctx.headers,
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
        headers: ctx.headers,
      });
    }),
} satisfies TRPCRouterRecord;
