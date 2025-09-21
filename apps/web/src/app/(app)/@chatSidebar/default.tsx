import { ComposerPrimitive, ThreadPrimitive } from "@assistant-ui/react";
import {
  ComposerAction,
  ComposerInput,
  ThreadScrollToBottom,
} from "~/components/assistant-ui/thread-components";
import { ThreadMessages } from "~/components/assistant-ui/thread-messages";
import { ComposerSources } from "~/components/assistant-ui/thread-sources";
import { ThreadWelcome } from "~/components/assistant-ui/thread-welcome";
import { Sidebar, SidebarContent } from "~/components/ui/sidebar";

const CHAT_SIDEBAR_DEFAULT_WIDTH = "20rem";
const CHAT_SIDEBAR_MIN_WIDTH = "20rem";
const CHAT_SIDEBAR_WIDTH_MAX = "50rem";
const CHAT_THREAD_MIN_WIDTH = "18rem"; // Leave 2rem for the padding.
const CHAT_THREAD_MAX_WIDTH = "50rem";

export default function ChatSidebar() {
  return (
    <Sidebar
      side="right"
      collapsible="offcanvas"
      variant="floating"
      className="sticky top-0 h-svh"
      defaultWidth={CHAT_SIDEBAR_DEFAULT_WIDTH}
      minWidth={CHAT_SIDEBAR_MIN_WIDTH}
      maxWidth={CHAT_SIDEBAR_WIDTH_MAX}
    >
      <SidebarContent className="overflow-x-hidden">
        <ThreadPrimitive.Root
          className="relative box-border flex h-full flex-col overflow-hidden pt-2"
          style={{
            minWidth: CHAT_THREAD_MIN_WIDTH,
            ["--thread-max-width" as string]: CHAT_THREAD_MAX_WIDTH,
            ["--thread-min-width" as string]: CHAT_THREAD_MIN_WIDTH,
          }}
        >
          <ThreadPrimitive.Viewport className="flex h-full flex-col items-center overflow-y-scroll scroll-smooth bg-inherit px-4">
            <ThreadWelcome />

            <ThreadMessages />

            <ThreadPrimitive.If empty={false}>
              <div className="min-h-8 flex-grow" />
            </ThreadPrimitive.If>

            <div className="sticky bottom-0 mt-3 flex w-full max-w-[var(--thread-max-width)] flex-col items-center justify-end rounded-t-lg bg-sidebar pb-4">
              <ThreadScrollToBottom />
              <ComposerPrimitive.Root className="relative flex w-full flex-col gap-y-2 rounded-lg border bg-muted px-1 pt-2 shadow-sm focus-within:border-ring/20 [&_button]:self-end">
                <ComposerSources />
                <ComposerInput className="py-0" />
                <ComposerAction />
              </ComposerPrimitive.Root>
            </div>
          </ThreadPrimitive.Viewport>
        </ThreadPrimitive.Root>
      </SidebarContent>
    </Sidebar>
  );
}
