import type { TRPCRouterRecord } from "@trpc/server";
import { referenceEmbedProcedures } from "./reference-embed-procedures";
export { addGraphOccurrence, createGraphSourceExcerpt, type GraphSourceExcerpt } from "./reference-api-helpers";
export const referencesRouter = {
  ...referenceEmbedProcedures,
} satisfies TRPCRouterRecord;
