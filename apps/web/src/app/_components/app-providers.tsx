"use client";

import { MantineProvider } from "@mantine/core";
import { ThemeProvider } from "next-themes";
import { JournlAgentAwarenessProvider } from "~/ai/agents/use-journl-agent-awareness";
import { ThreadRuntime } from "~/components/assistant-ui/thread-runtime";
import { DrawerProvider } from "~/components/ui/drawer";
import { TRPCReactProvider } from "~/trpc/react";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <MantineProvider>
        <JournlAgentAwarenessProvider>
          <TRPCReactProvider>
            <DrawerProvider>
              <ThreadRuntime
                transport={{
                  api: "/api/ai/journl-agent",
                }}
                messages={[]}
              >
                {children}
              </ThreadRuntime>
            </DrawerProvider>
          </TRPCReactProvider>
        </JournlAgentAwarenessProvider>
      </MantineProvider>
    </ThemeProvider>
  );
}
