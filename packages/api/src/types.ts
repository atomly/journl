import type { inferProcedureInput, inferProcedureOutput } from "@trpc/server";
import type { ApiRouter } from "./api-router";

export type BlockTransaction = inferProcedureInput<
  ApiRouter["journal"]["saveTransactions"]
>["transactions"][number];

export type TimelineEntry = inferProcedureOutput<
  ApiRouter["journal"]["getTimeline"]
>["timeline"][number];
