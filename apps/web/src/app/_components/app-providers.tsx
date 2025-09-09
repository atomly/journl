"use client";

import { MantineProvider } from "@mantine/core";
import { JournlAgentAwarenessProvider } from "~/ai/agents/use-journl-agent-awareness";
import { ThreadRuntime } from "~/components/assistant-ui/thread-runtime";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider>
      <JournlAgentAwarenessProvider>
        <ThreadRuntime
          transport={{
            api: "/api/ai/journl-agent",
          }}
          messages={[]}
        >
          {children}
        </ThreadRuntime>
      </JournlAgentAwarenessProvider>
    </MantineProvider>
  );
}
