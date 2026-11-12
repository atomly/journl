"use client";

import { DrawerProvider } from "@acme/ui/drawer";
import { ThemeProvider } from "next-themes";
import { JournalDraftsProvider } from "~/app/(app)/journal/_components/journal-drafts-provider";
import { ChatPresentationProvider } from "~/components/chat/chat-presentation";
import { DraftActivityProvider } from "~/components/editor/draft-activity-provider";
import { DraftOwnerProvider } from "~/components/editor/draft-sessions-provider";
import { PageDraftsProvider } from "~/components/editor/page-drafts-provider";
import { AppEventProvider } from "~/components/events/app-event-context";
import { AppPreferencesProvider } from "~/components/preferences/app-preferences-provider";
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
      <DraftOwnerProvider owner={owner}>
        <AppEventProvider>
          <TRPCReactProvider key={owner} owner={owner}>
            <AppPreferencesProvider initialPreferences={initialPreferences}>
              <DrawerProvider>
                <JournlAgentProvider>
                  <JournlChatProvider
                    owner={owner}
                    transport={{
                      api: "/api/ai/journl-agent",
                    }}
                    messages={[]}
                  >
                    <DraftActivityProvider>
                      <PageDraftsProvider>
                        <JournalDraftsProvider>
                          <ChatPresentationProvider>
                            {children}
                          </ChatPresentationProvider>
                        </JournalDraftsProvider>
                      </PageDraftsProvider>
                    </DraftActivityProvider>
                  </JournlChatProvider>
                </JournlAgentProvider>
              </DrawerProvider>
            </AppPreferencesProvider>
          </TRPCReactProvider>
        </AppEventProvider>
      </DraftOwnerProvider>
    </ThemeProvider>
  );
}
