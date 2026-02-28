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

type ThreadRuntimeContextState = {
  exceeded: UsageQuotaExceededPayload | null;
};

const ThreadRuntimeContext = createContext<ThreadRuntimeContextState>({
  exceeded: null,
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
    () => ({ exceeded: parseUsageQuotaExceededPayload(agent.error) }),
    [agent.error],
  );

  return (
    <ThreadRuntimeContext.Provider value={value}>
      <AssistantRuntimeProvider runtime={runtime}>
        {children}
      </AssistantRuntimeProvider>
    </ThreadRuntimeContext.Provider>
  );
}

export function useThreadRuntime() {
  return useContext(ThreadRuntimeContext);
}
