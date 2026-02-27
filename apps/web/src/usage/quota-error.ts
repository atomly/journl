import type { UsageQuota } from "@acme/db/usage";

export const USAGE_QUOTA_EXCEEDED_CODE = "USAGE_QUOTA_EXCEEDED" as const;
export const USAGE_QUOTA_EXCEEDED_ERROR = "Usage quota exceeded";
export const USAGE_QUOTA_EXCEEDED_MESSAGE =
  "You've reached your AI usage limit for this period. Upgrade to continue or wait for the next reset.";
export const CHAT_GENERIC_ERROR_MESSAGE =
  "Something went wrong. Please try again.";

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
    code === USAGE_QUOTA_EXCEEDED_CODE || code === USAGE_QUOTA_EXCEEDED_ERROR;

  if (!isQuotaExceededError) {
    return null;
  }

  return {
    code: USAGE_QUOTA_EXCEEDED_CODE,
    error:
      typeof payload.error === "string"
        ? payload.error
        : USAGE_QUOTA_EXCEEDED_ERROR,
    message:
      typeof payload.message === "string"
        ? payload.message
        : USAGE_QUOTA_EXCEEDED_MESSAGE,
    usage,
  };
}

export function getHumanReadableChatError(input: unknown): string {
  const quotaError = parseUsageQuotaExceededPayload(input);

  if (quotaError) {
    return quotaError.message;
  }

  const payload = parsePayloadCandidate(input);

  if (payload) {
    if (payload.code === "UNAUTHORIZED") {
      return "Your session expired. Please sign in again.";
    }

    if (payload.code === "TOO_MANY_REQUESTS") {
      return "Too many requests right now. Please wait a moment and try again.";
    }

    if (typeof payload.message === "string") {
      return humanizeErrorMessage(payload.message);
    }

    if (typeof payload.error === "string") {
      return humanizeErrorMessage(payload.error);
    }
  }

  if (input instanceof Error) {
    return humanizeErrorMessage(input.message);
  }

  if (typeof input === "string") {
    return humanizeErrorMessage(input);
  }

  return CHAT_GENERIC_ERROR_MESSAGE;
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

function humanizeErrorMessage(value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    return CHAT_GENERIC_ERROR_MESSAGE;
  }

  const parsed = parseJSONString(normalized);

  if (parsed) {
    if (typeof parsed.message === "string") {
      return humanizeErrorMessage(parsed.message);
    }

    if (typeof parsed.error === "string") {
      return humanizeErrorMessage(parsed.error);
    }
  }

  if (normalized === USAGE_QUOTA_EXCEEDED_ERROR) {
    return USAGE_QUOTA_EXCEEDED_MESSAGE;
  }

  if (normalized === "Internal Server Error") {
    return "Something went wrong on our side. Please try again.";
  }

  if (normalized === "Unauthorized") {
    return "Your session expired. Please sign in again.";
  }

  if (normalized.includes("Failed to fetch")) {
    return "We couldn't reach the server. Check your connection and try again.";
  }

  return normalized;
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
