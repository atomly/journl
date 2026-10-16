"use client";

import { ThemeProvider } from "next-themes";
import { JournalDraftsProvider } from "~/app/(app)/journal/_components/journal-drafts-provider";
import { ThreadRuntime } from "~/components/assistant-ui/thread-runtime";
import { DraftActivityProvider } from "~/components/editor/draft-activity-provider";
import { PageDraftsProvider } from "~/components/editor/page-drafts-provider";
import { AppEventProvider } from "~/components/events/app-event-context";
import { AppPreferencesProvider } from "~/components/preferences/app-preferences-provider";
import { DrawerProvider } from "~/components/ui/drawer";
import { JournlAgentProvider } from "~/hooks/use-journl-agent";
import { JournlChatProvider } from "~/hooks/use-journl-chat";
import type { AppPreferences } from "~/preferences/app-preferences";
import { TRPCReactProvider } from "~/trpc/react";

type AppProvidersProps = {
  children: React.ReactNode;
  owner: string;
  initialPreferences: AppPreferences;
};

export function AppProviders({
  children,
  owner,
  initialPreferences,
}: AppProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <AppEventProvider>
        <TRPCReactProvider key={owner} owner={owner}>
          <AppPreferencesProvider initialPreferences={initialPreferences}>
            <DrawerProvider>
              <JournlAgentProvider>
                <JournlChatProvider
                  transport={{
                    api: "/api/ai/journl-agent",
                  }}
                  messages={[]}
                >
                  <DraftActivityProvider>
                    <PageDraftsProvider>
                      <JournalDraftsProvider>
                        <ThreadRuntime>{children}</ThreadRuntime>
                      </JournalDraftsProvider>
                    </PageDraftsProvider>
                  </DraftActivityProvider>
                </JournlChatProvider>
              </JournlAgentProvider>
            </DrawerProvider>
          </AppPreferencesProvider>
        </TRPCReactProvider>
      </AppEventProvider>
    </ThemeProvider>
  );
}
