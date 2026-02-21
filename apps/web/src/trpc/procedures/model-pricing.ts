import { and, desc, eq, lte } from "@acme/db";
import { ModelPricing, zInsertModelPricing } from "@acme/db/schema";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";
import { protectedProcedure, publicProcedure } from "../trpc";

export const modelPricingRouter = {
  getAllPricingForModel: publicProcedure
    .input(
      z.object({
        model_id: z.string(),
        model_provider: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const pricing = await ctx.db.query.ModelPricing.findMany({
          orderBy: [desc(ModelPricing.effective_date)],
          where: and(
            eq(ModelPricing.model_id, input.model_id),
            eq(ModelPricing.model_provider, input.model_provider),
            lte(ModelPricing.effective_date, new Date().toISOString()),
          ),
        });

        return pricing;
      } catch (error) {
        console.error(
          "Database error in modelPricing.getAllPricingForModel:",
          error,
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get model pricing",
        });
      }
    }),
  getCurrentPricing: publicProcedure
    .input(
      z.object({
        model_id: z.string(),
        model_provider: z.string(),
        unit_type: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const pricing = await ctx.db.query.ModelPricing.findFirst({
          orderBy: [desc(ModelPricing.effective_date)],
          where: and(
            eq(ModelPricing.model_id, input.model_id),
            eq(ModelPricing.model_provider, input.model_provider),
            eq(ModelPricing.unit_type, input.unit_type),
            lte(ModelPricing.effective_date, new Date().toISOString()),
          ),
        });

        return pricing;
      } catch (error) {
        console.error(
          "Database error in modelPricing.getCurrentPricing:",
          error,
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get current pricing",
        });
      }
    }),

  upsertPricing: protectedProcedure
    .input(zInsertModelPricing)
    .mutation(async () => {
      // Intentionally disabled until we add an authenticated admin-only pricing flow.
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "modelPricing.upsertPricing is not implemented yet",
      });
    }),
} satisfies TRPCRouterRecord;
