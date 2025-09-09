"use client";

import type { ToolCall } from "@ai-sdk/provider-utils";
import type { UIMessage, UseChatHelpers } from "@ai-sdk/react";
import type { z } from "zod";

export type ClientToolResult<Name extends string = string, Output = unknown> = {
  tool: Name;
  toolCallId: string;
  output: Output;
};

export type CreateClientToolParams<
  Name extends string,
  Input,
  Chat extends UseChatHelpers<UIMessage> = UseChatHelpers<UIMessage>,
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
  Chat extends UseChatHelpers<UIMessage> = UseChatHelpers<UIMessage>,
> = {
  name: Name;
  execute: (
    toolCall: ToolCall<string, unknown>,
    chat: Chat,
  ) => void | PromiseLike<void>;
};

function validateToolCall<Name extends string, Input>(
  toolCall: ToolCall<string, unknown>,
  name: Name,
  inputSchema: z.ZodSchema<Input>,
): asserts toolCall is ToolCall<Name, Input> {
  const errors: string[] = [];

  const valid = inputSchema.safeParse(toolCall.input);

  if (!valid.success) {
    errors.push(valid.error.message);
  }

  if (toolCall.toolName !== name) {
    errors.push(`Invalid tool name: ${toolCall.toolName}`);
  }

  if (errors.length > 0) {
    throw new Error(`Invalid tool call: ${errors.join(", ")}`);
  }
}

export function createClientTool<
  Name extends string,
  Input,
  Chat extends UseChatHelpers<UIMessage> = UseChatHelpers<UIMessage>,
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
