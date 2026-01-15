"use client";

import { MantineProvider } from "@mantine/core";
import { ThemeProvider } from "next-themes";
import { JournlAgentAwarenessProvider } from "~/ai/agents/use-journl-agent-awareness";
import { ThreadRuntime } from "~/components/assistant-ui/thread-runtime";
import { AppEventProvider } from "~/components/events/app-event-context";
import { AppPreferencesProvider } from "~/components/preferences/app-preferences-provider";
import { DrawerProvider } from "~/components/ui/drawer";
import type { AppPreferences } from "~/preferences/app-preferences";
import { TRPCReactProvider } from "~/trpc/react";

type AppProvidersProps = {
  children: React.ReactNode;
  initialPreferences: AppPreferences;
};

export function AppProviders({
  children,
  initialPreferences,
}: AppProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <MantineProvider>
        <AppEventProvider>
          <JournlAgentAwarenessProvider>
            <TRPCReactProvider>
              <AppPreferencesProvider initialPreferences={initialPreferences}>
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
              </AppPreferencesProvider>
            </TRPCReactProvider>
          </JournlAgentAwarenessProvider>
        </AppEventProvider>
      </MantineProvider>
    </ThemeProvider>
  );
}
