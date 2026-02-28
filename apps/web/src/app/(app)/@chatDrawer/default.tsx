import { ComposerPrimitive, ThreadPrimitive } from "@assistant-ui/react";
import {
  ComposerAction,
  ComposerInput,
  ComposerQuotaNotice,
  ThreadScrollToBottom,
} from "~/components/assistant-ui/thread-components";
import {
  ComposerReasoning,
  ComposerReasoningContent,
  ComposerReasoningTrigger,
} from "~/components/assistant-ui/thread-context";
import { ThreadMessages } from "~/components/assistant-ui/thread-messages";
import { ComposerSources } from "~/components/assistant-ui/thread-sources";
import { ThreadWelcome } from "~/components/assistant-ui/thread-welcome";
import {
  Drawer,
  DrawerContent,
  DrawerDivider,
  DrawerTitle,
} from "~/components/ui/drawer";
import { ChatDrawerTrigger } from "./_components/chat-drawer-trigger";

const CHAT_DRAWER_CONTENT_ID = "chat-drawer-content";
const CHAT_DRAWER_REASONING_CONTENT_ID = "chat-drawer-reasoning-select-content";

export default function ChatDrawer() {
  return (
    <Drawer>
      <ChatDrawerTrigger
        aria-controls={CHAT_DRAWER_CONTENT_ID}
        className="fixed right-2 bottom-2 z-4500 flex md:hidden"
      />
      <DrawerContent
        id={CHAT_DRAWER_CONTENT_ID}
        className="z-4500 h-full! max-h-[82.5dvh]!"
      >
        <DrawerTitle className="hidden">Journl</DrawerTitle>
        <div className="relative h-full! border-sidebar-border border-t">
          <DrawerDivider className="absolute top-0 left-1/2 z-4500 -translate-x-1/2" />
          <ThreadPrimitive.Root
            className="relative box-border flex h-full flex-col overflow-hidden bg-sidebar pt-6"
            style={{
              ["--thread-max-width" as string]: "42rem",
            }}
          >
            <ThreadPrimitive.Viewport className="flex h-full flex-col items-center overflow-y-scroll scroll-smooth bg-inherit px-4">
              <ThreadWelcome />

              <ThreadMessages />

              <ThreadPrimitive.If empty={false}>
                <div className="min-h-8 grow" />
              </ThreadPrimitive.If>

              <div className="sticky bottom-0 mt-3 flex w-full max-w-(--thread-max-width) flex-col items-center justify-end rounded-t-lg bg-sidebar pb-4">
                <ThreadScrollToBottom />
                <ComposerPrimitive.Root className="relative flex w-full flex-col rounded-lg border border-sidebar-border/80 bg-muted/45 focus-within:border-ring/20">
                  <div className="relative space-y-2 rounded-tl-lg rounded-tr-lg bg-background pt-2">
                    <ComposerSources className="px-2" />
                    <ComposerQuotaNotice />
                    <ComposerInput autoFocus className="w-full px-3 py-2" />
                  </div>

                  <div className="flex min-w-0 flex-row justify-between border-sidebar-border/70 border-t p-2">
                    <ComposerReasoning>
                      <ComposerReasoningTrigger
                        aria-controls={CHAT_DRAWER_REASONING_CONTENT_ID}
                      />
                      <ComposerReasoningContent
                        id={CHAT_DRAWER_REASONING_CONTENT_ID}
                      />
                    </ComposerReasoning>
                    <ComposerAction
                      tooltip="Send message"
                      variant="outline"
                      className="size-9 rounded-lg border-primary/70! bg-background!"
                    />
                  </div>
                </ComposerPrimitive.Root>
              </div>
            </ThreadPrimitive.Viewport>
          </ThreadPrimitive.Root>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
