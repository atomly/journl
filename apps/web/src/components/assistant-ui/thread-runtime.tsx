"use client";

import { useChat } from "@ai-sdk/react";
import {
  AssistantRuntimeProvider,
  WebSpeechSynthesisAdapter,
} from "@assistant-ui/react";
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";
import { useJournlChat } from "~/ai/agents/use-journl-chat";

type ThreadRuntimeProps = {
  children: React.ReactNode;
};

export function ThreadRuntime({ children }: ThreadRuntimeProps) {
  const { chat } = useJournlChat();
  const agent = useChat({ chat });
  const runtime = useAISDKRuntime(agent, {
    adapters: {
      speech: new WebSpeechSynthesisAdapter(),
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
