import type { TRPCRouterRecord } from "@trpc/server";
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
} satisfies TRPCRouterRecord;
