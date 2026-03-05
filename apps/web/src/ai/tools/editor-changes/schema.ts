import { z } from "zod";
import { zJournlEditorId } from "~/ai/agents/journl-agent";

export const zEditorChangesInput = z.object({
  targetEditor: zJournlEditorId,
});
