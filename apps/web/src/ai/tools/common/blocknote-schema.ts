import { z } from "zod";
import { zJournlEditorId } from "~/ai/mastra/agents/journl-agent-context";

export const zEditorChangesInput = z.object({
  targetEditor: zJournlEditorId,
});
