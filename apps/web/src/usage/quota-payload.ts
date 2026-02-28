import type { UsageQuota } from "@acme/db/usage";

export const USAGE_QUOTA_EXCEEDED_CODE = "USAGE_QUOTA_EXCEEDED" as const;
export const USAGE_QUOTA_EXCEEDED_ERROR = "Usage quota exceeded";
export const USAGE_QUOTA_EXCEEDED_MESSAGE =
  "You've reached your AI usage limit for this period. Upgrade to continue or wait for the next reset.";

export type UsageQuotaExceededPayload = {
  code: typeof USAGE_QUOTA_EXCEEDED_CODE;
  error: string;
  message: string;
  usage: UsageQuota;
};

export function buildUsageQuotaExceededPayload(
  usage: UsageQuota,
): UsageQuotaExceededPayload {
  return {
    code: USAGE_QUOTA_EXCEEDED_CODE,
    error: USAGE_QUOTA_EXCEEDED_ERROR,
    message: USAGE_QUOTA_EXCEEDED_MESSAGE,
    usage,
  };
}
