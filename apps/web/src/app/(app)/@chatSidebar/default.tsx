import { ComposerPrimitive, ThreadPrimitive } from "@assistant-ui/react";
import {
  ComposerAction,
  ThreadScrollToBottom,
} from "~/components/ai/thread-components";
import { ThreadMessages } from "~/components/ai/thread-messages";
import { ThreadWelcome } from "~/components/ai/thread-welcome";
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
      className="sticky top-0 z-10 h-svh"
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
              <ComposerPrimitive.Root className="flex w-full flex-wrap items-center justify-end rounded-lg border bg-inherit px-2.5 shadow-sm transition-colors ease-in focus-within:border-ring/20">
                <ComposerPrimitive.Input
                  rows={1}
                  placeholder="Ask anything..."
                  className="max-h-40 flex-grow resize-none border-none px-2 py-4 text-md outline-none placeholder:text-muted-foreground focus:ring-0 disabled:cursor-not-allowed"
                />
                <ComposerAction />
              </ComposerPrimitive.Root>
            </div>
          </ThreadPrimitive.Viewport>
        </ThreadPrimitive.Root>
      </SidebarContent>
    </Sidebar>
  );
}
