import { ComposerPrimitive, ThreadPrimitive } from "@assistant-ui/react";
import { SendHorizontalIcon } from "lucide-react";
import {
  ComposerAction,
  ComposerInput,
  ThreadScrollToBottom,
} from "~/components/assistant-ui/thread-components";
import { ComposerContext } from "~/components/assistant-ui/thread-context";
import { ThreadMessages } from "~/components/assistant-ui/thread-messages";
import { ComposerSources } from "~/components/assistant-ui/thread-sources";
import { ThreadWelcome } from "~/components/assistant-ui/thread-welcome";
import { TooltipIconButton } from "~/components/assistant-ui/tooltip-icon-button";

import {
  Drawer,
  DrawerContent,
  DrawerDivider,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";

export default function ChatDrawer() {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <div className="p-2 md:hidden">
          <div className="flex w-full flex-row items-center justify-between rounded-lg border bg-sidebar px-2.5 py-4">
            <div className="w-full cursor-text px-2 text-muted-foreground text-sm">
              Ask anything...
            </div>
            <TooltipIconButton
              tooltip="Send"
              variant="default"
              className="size-8 p-2 transition-opacity ease-in"
            >
              <SendHorizontalIcon className="size-4" />
            </TooltipIconButton>
          </div>
        </div>
      </DrawerTrigger>
      <DrawerContent className="!h-full !max-h-[90dvh] z-4500">
        <DrawerTitle className="hidden">Journl</DrawerTitle>
        <div className="!h-full relative">
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
                <div className="min-h-8 flex-grow" />
              </ThreadPrimitive.If>

              <div className="sticky bottom-0 mt-3 flex w-full max-w-[var(--thread-max-width)] flex-col items-center justify-end rounded-t-lg bg-sidebar pb-4">
                <ThreadScrollToBottom />
                <ComposerPrimitive.Root className="relative flex w-full flex-col rounded-lg border bg-muted p-2 shadow-sm focus-within:border-ring/20 [&_button]:self-end">
                  <ComposerSources />
                  <ComposerInput className="py-0" />
                  <div className="relative mt-2 flex w-full flex-row items-end justify-between focus-within:border-ring/20">
                    <ComposerContext className="h-fit shrink-0 grow-0" />
                    <div className="ml-auto">
                      <ComposerAction />
                    </div>
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
