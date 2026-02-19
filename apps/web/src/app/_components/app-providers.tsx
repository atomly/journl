"use client";

import { ThemeProvider } from "next-themes";
import { JournlAgentProvider } from "~/ai/agents/use-journl-agent";
import { JournlChatProvider } from "~/ai/agents/use-journl-chat";
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
      <AppEventProvider>
        <TRPCReactProvider>
          <AppPreferencesProvider initialPreferences={initialPreferences}>
            <DrawerProvider>
              <JournlAgentProvider>
                <JournlChatProvider
                  transport={{
                    api: "/api/ai/journl-agent",
                  }}
                  messages={[]}
                >
                  <ThreadRuntime>{children}</ThreadRuntime>
                </JournlChatProvider>
              </JournlAgentProvider>
            </DrawerProvider>
          </AppPreferencesProvider>
        </TRPCReactProvider>
      </AppEventProvider>
    </ThemeProvider>
  );
}
