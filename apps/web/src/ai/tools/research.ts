import "server-only";
import { createTool } from "@mastra/core/tools";
import { z } from "zod/v4";
import { researchPublicWeb } from "~/ai/server/public-research";
import { zResearchFindings } from "./research-schema";

export type ResearchCache = Map<string, ReturnType<typeof researchPublicWeb>>;

export const research = createTool({
  description:
    "Research public facts and return findings with supporting sources. For a researched document edit, call this before write. The writer reuses these findings and cannot search again. Reuse completed findings; do not repeat the same question.",
  execute: async ({ query }, context) => {
    const userId = context?.requestContext?.get<"researchUserId", string>(
      "researchUserId",
    );
    const cache = context?.requestContext?.get<"researchCache", ResearchCache>(
      "researchCache",
    );
    if (!userId || !cache)
      throw new Error("Missing authenticated research context");
    const key = query.trim().replace(/\s+/g, " ").toLowerCase();
    let pending = cache.get(key);
    if (!pending) {
      pending = researchPublicWeb(query, userId, context?.abortSignal);
      cache.set(key, pending);
      void pending.catch(() => cache.delete(key));
    }
    return pending;
  },
  id: "webSearch",
  inputSchema: z.strictObject({ query: z.string().trim().min(1).max(2000) }),
  outputSchema: zResearchFindings,
});
