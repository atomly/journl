"use client";

import { RiSparkling2Fill } from "react-icons/ri";
import { useChatNudge } from "~/components/assistant-ui/use-chat-nudge";
import { Button } from "~/components/ui/button";
import { DrawerTrigger, useDrawer } from "~/components/ui/drawer";
import { cn } from "~/lib/cn";

type ChatDrawerTriggerProps = Omit<
  React.ComponentProps<typeof DrawerTrigger>,
  "children"
>;

export function ChatDrawerTrigger({
  className,
  ...props
}: ChatDrawerTriggerProps) {
  const { isOpen } = useDrawer();
  const {
    hasUnreadAssistantMessages,
    unreadAssistantMessages,
    unreadAssistantMessagesLabel,
  } = useChatNudge(isOpen);

  return (
    <DrawerTrigger asChild>
      <Button
        size="icon"
        className={cn(
          "relative size-10 cursor-pointer rounded-full border",
          className,
        )}
        {...props}
      >
        <RiSparkling2Fill className="size-6" />
        {hasUnreadAssistantMessages ? (
          <span className="absolute -top-1 -right-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 font-semibold text-[0.625rem] text-primary-foreground leading-none">
            {unreadAssistantMessagesLabel}
          </span>
        ) : null}
        <span className="sr-only">Toggle Chat Drawer</span>
        {hasUnreadAssistantMessages ? (
          <span className="sr-only">
            {unreadAssistantMessages} unread assistant
            {unreadAssistantMessages > 1 ? " messages" : " message"}
          </span>
        ) : null}
      </Button>
    </DrawerTrigger>
  );
}
