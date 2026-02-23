import { ComposerPrimitive, ThreadPrimitive } from "@assistant-ui/react";
import { Sparkles } from "lucide-react";
import {
  ComposerAction,
  ComposerInput,
  ThreadScrollToBottom,
} from "~/components/assistant-ui/thread-components";
import { ComposerContext } from "~/components/assistant-ui/thread-context";
import { ThreadMessages } from "~/components/assistant-ui/thread-messages";
import { ComposerSources } from "~/components/assistant-ui/thread-sources";
import { ThreadWelcome } from "~/components/assistant-ui/thread-welcome";
import { Button } from "~/components/ui/button";

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
        <Button
          size="icon"
          className="fixed right-2 bottom-2 flex size-10 cursor-pointer rounded-full border md:hidden"
        >
          <Sparkles className="size-6" />
          <span className="sr-only">Toggle Chat Drawer</span>
        </Button>
      </DrawerTrigger>
      <DrawerContent className="z-4500 h-full! max-h-[90dvh]!">
        <DrawerTitle className="hidden">Journl</DrawerTitle>
        <div className="relative h-full!">
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
