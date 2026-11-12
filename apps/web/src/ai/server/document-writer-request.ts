import { documentRows, zDocumentBlock } from "@acme/document";
import { z } from "zod";
import { zJournlEditorId } from "../mastra/agents/journl-agent-context";
import { zOpenAIReasoningEffort } from "../mastra/agents/journl-agent-reasoning";
import {
  WRITING_CONTEXT_CHARACTERS,
  WRITING_CONTEXT_MESSAGES,
} from "../writing-context";

const requestSchema = z
  .strictObject({
    blocks: z.array(zDocumentBlock),
    conversation: z
      .array(
        z.strictObject({
          content: z.string().min(1).max(WRITING_CONTEXT_CHARACTERS),
          role: z.enum(["user", "assistant"]),
        }),
      )
      .max(WRITING_CONTEXT_MESSAGES)
      .refine(
        (messages) =>
          messages.reduce((sum, message) => sum + message.content.length, 0) <=
          WRITING_CONTEXT_CHARACTERS,
      )
      .optional(),
    instruction: z.string().trim().min(1).max(20_000),
    reasoningEffort: zOpenAIReasoningEffort.optional(),
    scope: z.enum(["document", "blocks", "inline"]),
    targetEditor: zJournlEditorId.refine((target) =>
      target.startsWith("page:")
        ? z.uuid().safeParse(target.slice(5)).success
        : z.iso.date().safeParse(target.slice("journal-entry:".length)).success,
    ),
  })
  .refine(({ scope, blocks }) => scope !== "inline" || blocks.length === 1);

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
