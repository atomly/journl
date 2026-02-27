"use client";

import { useChat } from "@ai-sdk/react";
import {
  AssistantRuntimeProvider,
  WebSpeechSynthesisAdapter,
} from "@assistant-ui/react";
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";
import { createContext, useContext, useMemo } from "react";
import { useJournlChat } from "~/ai/agents/use-journl-chat";
import {
  parseUsageQuotaExceededPayload,
  type UsageQuotaExceededPayload,
} from "~/usage/quota-error";

type ThreadRuntimeProps = {
  children: React.ReactNode;
};

type ThreadChatErrorState = {
  usageQuotaExceeded: UsageQuotaExceededPayload | null;
};

const ThreadChatErrorContext = createContext<ThreadChatErrorState>({
  usageQuotaExceeded: null,
});

export function ThreadRuntime({ children }: ThreadRuntimeProps) {
  const { chat } = useJournlChat();
  const agent = useChat({ chat });
  const usageQuotaExceeded = parseUsageQuotaExceededPayload(agent.error);
  const runtime = useAISDKRuntime(agent, {
    adapters: {
      speech: new WebSpeechSynthesisAdapter(),
    },
  });

  const chatErrorState = useMemo(
    () => ({ usageQuotaExceeded }),
    [usageQuotaExceeded],
  );

  return (
    <ThreadChatErrorContext.Provider value={chatErrorState}>
      <AssistantRuntimeProvider runtime={runtime}>
        {children}
      </AssistantRuntimeProvider>
    </ThreadChatErrorContext.Provider>
  );
}

export function useThreadChatError() {
  return useContext(ThreadChatErrorContext);
}
