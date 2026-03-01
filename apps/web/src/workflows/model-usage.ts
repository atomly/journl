import { and, desc, eq, lte, sql } from "@acme/db";
import { db } from "@acme/db/client";
import { ModelPricing, UsageAggregate } from "@acme/db/schema";
import { ensureUsagePeriodAtDate, zUsageUnit } from "@acme/db/usage";
import { inArray } from "drizzle-orm";
import { FatalError } from "workflow";
import { start } from "workflow/api";
import { z } from "zod/v4";

import { createTransaction } from "./utils/transaction";

const zUsageMetric = z.object({
  quantity: z.number().nonnegative(),
  unit: zUsageUnit,
});

const zModelUsageInput = z.object({
  metrics: z.array(zUsageMetric).min(1),
  modelId: z.string().min(1),
  modelProvider: z.string().min(1),
  occurredAt: z.iso.datetime().optional(),
  userId: z.string().min(1),
});

type ModelUsageInput = z.infer<typeof zModelUsageInput>;

export async function startModelUsage(input: ModelUsageInput) {
  await start(runModelUsage, [input]);
}

type UsageAggregationResult = {
  costAdded: number;
  success: true;
  usagePeriodId: string;
};

export async function runModelUsage(
  input: ModelUsageInput,
): Promise<UsageAggregationResult> {
  "use workflow";

  const payload = await validateModelUsageInput(input);
  const eventDate = payload.occurredAt ?? new Date().toISOString();

  const { usagePeriodId } = await resolveUsagePeriod({
    eventDate,
    userId: payload.userId,
  });

  const { totalCost } = await determineUsageCost({
    eventDate,
    metrics: payload.metrics,
    modelId: payload.modelId,
    modelProvider: payload.modelProvider,
  });

  return await increaseUsageAggregate({
    totalCost,
    usagePeriodId,
    userId: payload.userId,
  });
}

async function validateModelUsageInput(
  input: ModelUsageInput,
): Promise<ModelUsageInput> {
  "use step";

  return zModelUsageInput.parse(input);
}

async function resolveUsagePeriod(input: {
  eventDate: string;
  userId: string;
}): Promise<{ usagePeriodId: string }> {
  "use step";

  return await createTransaction(async (tx) => {
    const period = await ensureUsagePeriodAtDate(
      tx,
      input.userId,
      input.eventDate,
    );

    return {
      usagePeriodId: period.id,
    };
  });
}
resolveUsagePeriod.maxRetries = 5;

async function determineUsageCost(input: {
  eventDate: string;
  metrics: Array<z.infer<typeof zUsageMetric>>;
  modelId: string;
  modelProvider: string;
}): Promise<{ totalCost: number }> {
  "use step";

  const quantitiesByUnit = new Map<string, number>();
  for (const metric of input.metrics) {
    quantitiesByUnit.set(
      metric.unit,
      (quantitiesByUnit.get(metric.unit) ?? 0) + metric.quantity,
    );
  }

  const units = [...quantitiesByUnit.keys()];

  const pricingRecords = await db
    .select({
      pricePerUnit: ModelPricing.price_per_unit,
      unitType: ModelPricing.unit_type,
    })
    .from(ModelPricing)
    .where(
      and(
        eq(ModelPricing.model_id, input.modelId),
        eq(ModelPricing.model_provider, input.modelProvider),
        inArray(ModelPricing.unit_type, units),
        lte(ModelPricing.effective_date, input.eventDate),
      ),
    )
    .orderBy(desc(ModelPricing.effective_date));

  const priceByUnit = new Map<string, number>();
  for (const price of pricingRecords) {
    if (!priceByUnit.has(price.unitType)) {
      priceByUnit.set(price.unitType, Number.parseFloat(price.pricePerUnit));
    }
  }

  let totalCost = 0;
  for (const [unit, quantity] of quantitiesByUnit) {
    const price = priceByUnit.get(unit);
    if (!price) {
      console.warn(
        `No pricing for model ${input.modelId} (${input.modelProvider}) unit ${unit}`,
      );
      continue;
    }

    totalCost += price * quantity;
  }

  return { totalCost };
}

async function increaseUsageAggregate(input: {
  totalCost: number;
  usagePeriodId: string;
  userId: string;
}): Promise<UsageAggregationResult> {
  "use step";

  if (input.totalCost < 0) {
    throw new FatalError("Total cost cannot be negative");
  }

  if (input.totalCost === 0) {
    return {
      costAdded: 0,
      success: true,
      usagePeriodId: input.usagePeriodId,
    };
  }

  const totalCostAsString = input.totalCost.toFixed(6);

  await db
    .insert(UsageAggregate)
    .values({
      total_cost: totalCostAsString,
      usage_period_id: input.usagePeriodId,
      user_id: input.userId,
    })
    .onConflictDoUpdate({
      set: {
        total_cost: sql`${UsageAggregate.total_cost} + ${totalCostAsString}`,
      },
      target: [UsageAggregate.user_id, UsageAggregate.usage_period_id],
    });

  return {
    costAdded: input.totalCost,
    success: true,
    usagePeriodId: input.usagePeriodId,
  };
}
increaseUsageAggregate.maxRetries = 5;
