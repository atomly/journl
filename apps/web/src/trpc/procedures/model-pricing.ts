import { and, desc, eq, lte } from "@acme/db";
import { ModelPricing, zInsertModelPricing } from "@acme/db/schema";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";
import { publicProcedure } from "../trpc";

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

  upsertPricing: publicProcedure
    .input(zInsertModelPricing)
    .mutation(async ({ ctx, input }) => {
      try {
        const [pricing] = await ctx.db
          .insert(ModelPricing)
          .values(input)
          .onConflictDoUpdate({
            set: {
              price_per_unit: input.price_per_unit,
            },
            target: [
              ModelPricing.model_id,
              ModelPricing.model_provider,
              ModelPricing.unit_type,
              ModelPricing.effective_date,
            ],
          })
          .returning();

        return pricing;
      } catch (error) {
        console.error("Database error in modelPricing.upsertPricing:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to upsert pricing",
        });
      }
    }),
} satisfies TRPCRouterRecord;
