import { safeValidateUIMessages, type UIMessage } from "ai";
import { z } from "zod";
import { zJournlAgentContext } from "../mastra/agents/journl-agent-context";

// Only these fields may influence a run. Agent, model, memory ownership, tools,
// provider options, and authenticated identity are chosen by the server.
const requestSchema = z.object({
  context: zJournlAgentContext.omit({ user: true }),
  messages: z.array(z.unknown()).min(1),
  trigger: z.enum(["submit-message", "regenerate-message"]).optional(),
});

export class InvalidChatRequest extends Error {
  constructor() {
    super("Invalid chat request");
    this.name = "InvalidChatRequest";
  }
}

export type JournlChatRequest = Omit<
  z.infer<typeof requestSchema>,
  "messages"
> & {
  messages: UIMessage[];
};

/** Validate client-controlled UI messages and context before creating a model run.
 * Unknown execution settings are discarded; message parts remain in the SDK's
 * native format so tool continuations, reasoning, and source parts survive.
 */
export async function parseJournlChatRequest(
  body: unknown,
): Promise<JournlChatRequest> {
  const request = requestSchema.safeParse(body);
  if (!request.success) throw new InvalidChatRequest();
  const messages = await safeValidateUIMessages({
    messages: request.data.messages,
  });
  if (!messages.success) throw new InvalidChatRequest();
  return { ...request.data, messages: messages.data };
}
