import type { UsageQuota } from "@acme/db/usage";

export const USAGE_QUOTA_EXCEEDED_CODE = "USAGE_QUOTA_EXCEEDED" as const;
export const USAGE_QUOTA_EXCEEDED_MESSAGE = "Usage quota exceeded";

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
    error: USAGE_QUOTA_EXCEEDED_MESSAGE,
    message: USAGE_QUOTA_EXCEEDED_MESSAGE,
    usage,
  };
}

export function parseUsageQuotaExceededPayload(
  input: unknown,
): UsageQuotaExceededPayload | null {
  const payload = parsePayloadCandidate(input);

  if (!payload) {
    return null;
  }

  const usage = isUsageQuota(payload.usage) ? payload.usage : null;
  if (!usage) {
    return null;
  }

  const code =
    typeof payload.code === "string"
      ? payload.code
      : typeof payload.error === "string"
        ? payload.error
        : null;

  const isQuotaExceededError =
    code === USAGE_QUOTA_EXCEEDED_CODE || code === USAGE_QUOTA_EXCEEDED_MESSAGE;

  if (!isQuotaExceededError) {
    return null;
  }

  return {
    code: USAGE_QUOTA_EXCEEDED_CODE,
    error:
      typeof payload.error === "string"
        ? payload.error
        : USAGE_QUOTA_EXCEEDED_MESSAGE,
    message:
      typeof payload.message === "string"
        ? payload.message
        : USAGE_QUOTA_EXCEEDED_MESSAGE,
    usage,
  };
}

function parsePayloadCandidate(input: unknown): Record<string, unknown> | null {
  if (!input) {
    return null;
  }

  if (typeof input === "string") {
    return parseJSONString(input);
  }

  if (input instanceof Error) {
    return parseJSONString(input.message) ?? parsePayloadCandidate(input.cause);
  }

  if (isRecord(input)) {
    return input;
  }

  return null;
}

function parseJSONString(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isUsageQuota(value: unknown): value is UsageQuota {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.canUse === "boolean" &&
    typeof value.currentUsageUsd === "number" &&
    typeof value.quotaUsd === "number" &&
    typeof value.remainingQuotaUsd === "number" &&
    (value.subscriptionType === "free" || value.subscriptionType === "pro") &&
    (typeof value.usagePeriodId === "string" || value.usagePeriodId === null)
  );
}
