import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";
import { protectedProcedure } from "../trpc";

export const subscriptionRouter = {
  getActiveSubscription: protectedProcedure.query(async ({ ctx }) => {
    const subscriptions = await ctx.authApi.listActiveSubscriptions({
      headers: ctx.headers,
      query: {
        referenceId: ctx.session.user.id,
      },
    });
    return subscriptions.find(
      (sub) => sub.status === "active" || sub.status === "trialing",
    );
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
