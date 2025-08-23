"use client";

import {
  AssistantRuntimeProvider,
  WebSpeechSynthesisAdapter,
} from "@assistant-ui/react";
import {
  type UseChatRuntimeOptions,
  useChatRuntime,
} from "@assistant-ui/react-ai-sdk";

type ThreadRuntimeProps = {
  children: React.ReactNode;
} & Pick<UseChatRuntimeOptions, "api" | "initialMessages">;

export function ThreadRuntime({
  children,
  api,
  initialMessages,
}: ThreadRuntimeProps) {
  const runtime = useChatRuntime({
    adapters: {
      speech: new WebSpeechSynthesisAdapter(),
    },
    api,
    initialMessages,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
