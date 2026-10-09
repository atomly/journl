import type { TRPCRouterRecord } from "@trpc/server";
import { referenceEmbedProcedures } from "./reference-embed-procedures";
import { referenceGraphProcedures } from "./reference-graph-procedures";
import { referenceBacklinksProcedures } from "./reference-backlinks-procedures";
export { addGraphOccurrence, createGraphSourceExcerpt, type GraphSourceExcerpt } from "./reference-api-helpers";
export const referencesRouter = {
  ...referenceEmbedProcedures,
  ...referenceGraphProcedures,
  ...referenceBacklinksProcedures,
} satisfies TRPCRouterRecord;
