export type UsageQuota = {
  canUse: boolean;
  currentUsageUsd: number;
  quotaUsd: number;
  remainingQuotaUsd: number;
  subscriptionType: "free" | "pro";
  usagePeriodId: string | null;
};

export type UsageQuotaPeriodSnapshot = {
  id: string | null;
  plan: {
    quota: number;
  } | null;
  subscription: {
    id?: string;
  } | null;
  usageAggregate: {
    total_cost: string | null;
  } | null;
};

function parseUsageCost(totalCost: string | null): number {
  if (!totalCost) {
    return 0;
  }

  const parsed = Number.parseFloat(totalCost);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Pure quota policy mapping.
 *
 * Keep this function side-effect free. All reads/writes belong in usage-service.
 */
export function getPeriodUsageQuota(
  period: UsageQuotaPeriodSnapshot,
): UsageQuota {
  if (!period.plan) {
    throw new Error("Usage period missing plan data");
  }

  const quotaUsd = period.plan.quota / 100;
  const currentUsageUsd = parseUsageCost(
    period.usageAggregate?.total_cost ?? null,
  );
  const remainingQuotaUsd = Math.max(0, quotaUsd - currentUsageUsd);

  return {
    canUse: currentUsageUsd < quotaUsd,
    currentUsageUsd,
    quotaUsd,
    remainingQuotaUsd,
    subscriptionType: period.subscription ? "pro" : "free",
    usagePeriodId: period.id,
  };
}
