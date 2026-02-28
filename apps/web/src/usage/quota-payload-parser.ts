import type { UsageQuota } from "@acme/db/usage";
import { type ErrorEnvelope, parseErrorEnvelope } from "./parsers";
import {
  USAGE_QUOTA_EXCEEDED_CODE,
  USAGE_QUOTA_EXCEEDED_ERROR,
  USAGE_QUOTA_EXCEEDED_MESSAGE,
  type UsageQuotaExceededPayload,
} from "./quota-payload";

type UnknownRecord = Record<string, unknown>;

export function parseUsageQuotaExceededPayload(
  input: unknown,
): UsageQuotaExceededPayload | null {
  return parseUsageQuotaExceededPayloadFromEnvelope(parseErrorEnvelope(input));
}

export function parseUsageQuotaExceededPayloadFromEnvelope(
  envelope: ErrorEnvelope,
): UsageQuotaExceededPayload | null {
  if (!isQuotaExceededCode(envelope.code) || !envelope.payload) {
    return null;
  }

  const usage = parseUsageQuota(envelope.payload.usage);
  if (!usage) {
    return null;
  }

  const payload = envelope.payload;

  return {
    code: USAGE_QUOTA_EXCEEDED_CODE,
    error: getString(payload.error) ?? USAGE_QUOTA_EXCEEDED_ERROR,
    message: getString(payload.message) ?? USAGE_QUOTA_EXCEEDED_MESSAGE,
    usage,
  };
}

function parseUsageQuota(value: unknown): UsageQuota | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const canUse = getBoolean(record.canUse);
  const currentUsageUsd = getNumber(record.currentUsageUsd);
  const quotaUsd = getNumber(record.quotaUsd);
  const remainingQuotaUsd = getNumber(record.remainingQuotaUsd);
  const subscriptionType = getString(record.subscriptionType);
  const usagePeriodId = record.usagePeriodId;
  const periodEnd = record.periodEnd;

  if (
    canUse === null ||
    currentUsageUsd === null ||
    quotaUsd === null ||
    remainingQuotaUsd === null ||
    (subscriptionType !== "free" && subscriptionType !== "pro") ||
    (typeof usagePeriodId !== "string" && usagePeriodId !== null) ||
    (typeof periodEnd !== "string" &&
      periodEnd !== null &&
      typeof periodEnd !== "undefined")
  ) {
    return null;
  }

  return {
    canUse,
    currentUsageUsd,
    periodEnd: periodEnd ?? null,
    quotaUsd,
    remainingQuotaUsd,
    subscriptionType,
    usagePeriodId,
  };
}

function isQuotaExceededCode(code: string | null): boolean {
  return (
    code === USAGE_QUOTA_EXCEEDED_CODE || code === USAGE_QUOTA_EXCEEDED_ERROR
  );
}

function asRecord(value: unknown): UnknownRecord | null {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function getBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}
