import { getUsagePeriod, getUsageQuota } from "@acme/db/usage";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { protectedProcedure } from "../trpc";

export const usageRouter = {
  getCurrentUsagePeriod: protectedProcedure.query(async ({ ctx }) => {
    return await getUsagePeriod(ctx.db, ctx.session.user.id);
  }),
  // Query-only contract: this endpoint must not create UsagePeriod/UsageAggregate rows.
  getUsageQuota: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await getUsageQuota(ctx.db, ctx.session.user.id);
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error ? error.message : "Failed to check usage",
      });
    }
  }),
} satisfies TRPCRouterRecord;
