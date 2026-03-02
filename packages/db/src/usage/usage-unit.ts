import z from "zod/v4";

export const USAGE_UNITS = {
  INPUT_TOKENS: "input_tokens",
  OUTPUT_TOKENS: "output_tokens",
  REASONING_TOKENS: "reasoning_tokens",
  REQUESTS: "requests",
  TOKENS: "tokens",
  WEB_SEARCH_CALLS: "web_search_calls",
} as const;

export const zUsageUnit = z.enum([
  USAGE_UNITS.INPUT_TOKENS,
  USAGE_UNITS.OUTPUT_TOKENS,
  USAGE_UNITS.REASONING_TOKENS,
  USAGE_UNITS.REQUESTS,
  USAGE_UNITS.TOKENS,
  USAGE_UNITS.WEB_SEARCH_CALLS,
]);

export type UsageUnit = z.infer<typeof zUsageUnit>;
