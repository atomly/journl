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

type ThreadUsageState = {
  usageQuotaExceeded: UsageQuotaExceededPayload | null;
};

const ThreadUsageContext = createContext<ThreadUsageState>({
  usageQuotaExceeded: null,
});

export function ThreadRuntime({ children }: ThreadRuntimeProps) {
  const { chat } = useJournlChat();
  const agent = useChat({ chat });
  const runtime = useAISDKRuntime(agent, {
    adapters: {
      speech: new WebSpeechSynthesisAdapter(),
    },
  });

  const value = useMemo(
    () => ({ usageQuotaExceeded: parseUsageQuotaExceededPayload(agent.error) }),
    [agent.error],
  );

  return (
    <ThreadUsageContext.Provider value={value}>
      <AssistantRuntimeProvider runtime={runtime}>
        {children}
      </AssistantRuntimeProvider>
    </ThreadUsageContext.Provider>
  );
}

export function useThreadUsage() {
  return useContext(ThreadUsageContext);
}
