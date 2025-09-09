"use client";

import {
  AssistantRuntimeProvider,
  WebSpeechSynthesisAdapter,
} from "@assistant-ui/react";
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";
import type { ChatInit, HttpChatTransportInitOptions, UIMessage } from "ai";
import { useJournlAgent } from "~/ai/agents/use-journl-agent";

type ThreadRuntimeProps<Message extends UIMessage = UIMessage> = {
  children: React.ReactNode;
} & Pick<ChatInit<Message>, "messages"> & {
    transport: Pick<HttpChatTransportInitOptions<Message>, "api">;
  };

export function ThreadRuntime({
  children,
  transport,
  messages,
}: ThreadRuntimeProps) {
  const agent = useJournlAgent({
    messages,
    transport,
  });
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
