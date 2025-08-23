"use client";

import { ThreadPrimitive } from "@assistant-ui/react";
import {
  AssistantMessage,
  EditComposer,
  UserMessage,
} from "~/components/ai/thread-components";

export function ThreadMessages() {
  return (
    <ThreadPrimitive.Messages
      components={{
        AssistantMessage: AssistantMessage,
        EditComposer: EditComposer,
        UserMessage: UserMessage,
      }}
    />
  );
}
