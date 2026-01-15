import type { inferProcedureInput, inferProcedureOutput } from "@trpc/server";
import type { ApiRouter } from "./api-router";

export type BlockTransaction = inferProcedureInput<
  ApiRouter["journal"]["saveTransactions"]
>["transactions"][number];

export type TimelineEntry = inferProcedureOutput<
  ApiRouter["journal"]["getTimeline"]
>["timeline"][number];

export type JournalEntry = inferProcedureOutput<
  ApiRouter["journal"]["getEntries"]
>["timeline"][number];

export type JournalListEntry = TimelineEntry | JournalEntry;

export type Subscription = inferProcedureOutput<
  ApiRouter["subscription"]["getSubscription"]
>;

export type ProPlan = inferProcedureOutput<
  ApiRouter["subscription"]["getProPlan"]
>;

export type UpgradedSubscription = inferProcedureOutput<
  ApiRouter["subscription"]["upgradeSubscription"]
>;

export type BillingPortal = inferProcedureOutput<
  ApiRouter["subscription"]["createBillingPortal"]
>;

export type PaginatedPagesInput = inferProcedureInput<
  ApiRouter["pages"]["getPaginated"]
>;

export type InfiniteJournalEntriesInput = inferProcedureInput<
  ApiRouter["journal"]["getTimeline"]
>;

export type InfiniteEntriesInput = inferProcedureInput<
  ApiRouter["journal"]["getEntries"]
>;
