import type { ToolCall } from "@ai-sdk/provider-utils";
import type { Chat as AISDKChat, UIMessage } from "@ai-sdk/react";
import type { z } from "zod";

type CreateClientToolParams<
  Name extends string,
  Input,
  Chat extends AISDKChat<UIMessage> = AISDKChat<UIMessage>,
> = {
  name: Name;
  inputSchema: z.ZodSchema<Input>;
  execute: (
    toolCall: ToolCall<Name, Input>,
    chat: Chat,
  ) => void | PromiseLike<void>;
};

export type ClientTool<
  Name extends string,
  Chat extends AISDKChat<UIMessage> = AISDKChat<UIMessage>,
> = {
  name: Name;
  execute: (
    toolCall: ToolCall<string, unknown>,
    chat: Chat,
  ) => void | PromiseLike<void>;
};

export class InvalidClientToolCall extends Error {
  constructor(name: string) {
    super(
      `The assistant sent invalid arguments for ${name}. Send your request again.`,
    );
    this.name = "InvalidClientToolCall";
  }
}

function validateToolCall<Name extends string, Input>(
  toolCall: ToolCall<string, unknown>,
  name: Name,
  inputSchema: z.ZodSchema<Input>,
): asserts toolCall is ToolCall<Name, Input> {
  if (
    toolCall.toolName !== name ||
    !inputSchema.safeParse(toolCall.input).success
  )
    throw new InvalidClientToolCall(name);
}

export function createClientTool<
  Name extends string,
  Input,
  Chat extends AISDKChat<UIMessage> = AISDKChat<UIMessage>,
>({
  name,
  inputSchema,
  execute,
}: CreateClientToolParams<Name, Input, Chat>): ClientTool<Name, Chat> {
  return {
    execute: (toolCall, chat) => {
      validateToolCall<Name, Input>(toolCall, name, inputSchema);
      return execute(toolCall, chat);
    },
    name,
  };
}
