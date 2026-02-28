import { type ErrorEnvelope, parseErrorEnvelope } from "./parsers";
import {
  USAGE_QUOTA_EXCEEDED_CODE,
  USAGE_QUOTA_EXCEEDED_ERROR,
  USAGE_QUOTA_EXCEEDED_MESSAGE,
} from "./quota-payload";
import { parseUsageQuotaExceededPayloadFromEnvelope } from "./quota-payload-parser";

export const CHAT_GENERIC_ERROR_MESSAGE =
  "Something went wrong. Please try again.";

export function getHumanReadableChatError(input: unknown): string {
  const envelope = parseErrorEnvelope(input);
  return humanizeEnvelope(envelope) ?? CHAT_GENERIC_ERROR_MESSAGE;
}

function humanizeEnvelope(envelope: ErrorEnvelope, depth = 0): string | null {
  const quotaPayload = parseUsageQuotaExceededPayloadFromEnvelope(envelope);
  if (quotaPayload) {
    return quotaPayload.message;
  }

  const mappedCode = mapKnownErrorCode(envelope.code);
  if (mappedCode) {
    return mappedCode;
  }

  if (!envelope.message) {
    return null;
  }

  return humanizeMessageText(envelope.message, depth);
}

function humanizeMessageText(value: string, depth: number): string {
  const normalized = value.trim();

  if (!normalized) {
    return CHAT_GENERIC_ERROR_MESSAGE;
  }

  if (depth < 2) {
    const nestedEnvelope = parseErrorEnvelope(normalized);

    if (nestedEnvelope.payload) {
      const nestedMessage = humanizeEnvelope(nestedEnvelope, depth + 1);

      if (nestedMessage) {
        return nestedMessage;
      }
    }
  }

  return mapKnownRawMessage(normalized) ?? normalized;
}

function mapKnownErrorCode(code: string | null): string | null {
  if (code === USAGE_QUOTA_EXCEEDED_CODE) {
    return USAGE_QUOTA_EXCEEDED_MESSAGE;
  }

  if (code === "UNAUTHORIZED") {
    return "Your session expired. Please sign in again.";
  }

  if (code === "TOO_MANY_REQUESTS") {
    return "Too many requests right now. Please wait a moment and try again.";
  }

  return null;
}

function mapKnownRawMessage(value: string): string | null {
  if (value === USAGE_QUOTA_EXCEEDED_ERROR) {
    return USAGE_QUOTA_EXCEEDED_MESSAGE;
  }

  if (value === "Internal Server Error") {
    return "Something went wrong on our side. Please try again.";
  }

  if (value === "Unauthorized") {
    return "Your session expired. Please sign in again.";
  }

  if (value.includes("Failed to fetch")) {
    return "We couldn't reach the server. Check your connection and try again.";
  }

  return null;
}
