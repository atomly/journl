import type { TRPCRouterRecord } from "@trpc/server";
import { referenceEmbedProcedures } from "./reference-embed-procedures";
import { referenceGraphProcedures } from "./reference-graph-procedures";
export { addGraphOccurrence, createGraphSourceExcerpt, type GraphSourceExcerpt } from "./reference-api-helpers";
export const referencesRouter = {
  ...referenceEmbedProcedures,
  ...referenceGraphProcedures,
} satisfies TRPCRouterRecord;
