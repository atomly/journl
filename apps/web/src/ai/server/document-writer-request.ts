import { documentRows, zDocumentBlock } from "@acme/document";
import { z } from "zod";
import { zJournlEditorId } from "../mastra/agents/journl-agent-context";
import { zOpenAIReasoningEffort } from "../mastra/agents/journl-agent-reasoning";

const requestSchema = z.strictObject({
  blocks: z.array(zDocumentBlock),
  instruction: z.string().trim().min(1).max(20_000),
  reasoningEffort: zOpenAIReasoningEffort.optional(),
  targetEditor: zJournlEditorId.refine((target) =>
    target.startsWith("page:")
      ? z.uuid().safeParse(target.slice(5)).success
      : z.iso.date().safeParse(target.slice("journal-entry:".length)).success,
  ),
});

export type DocumentWriterRequest = z.infer<typeof requestSchema>;

export class InvalidDocumentWriterRequest extends Error {
  constructor() {
    super("Invalid document writing request");
    this.name = "InvalidDocumentWriterRequest";
  }
}

/** A generation snapshot may include unsaved local writing. It is not a save
 * request or proof of ownership; the route authorizes the target separately. */
export function parseDocumentWriterRequest(
  body: unknown,
): DocumentWriterRequest {
  try {
    const request = requestSchema.parse(body);
    documentRows(request.blocks);
    return request;
  } catch {
    throw new InvalidDocumentWriterRequest();
  }
}
