"use client";

import { Button } from "@acme/ui/button";
import { DrawerTrigger, useDrawer } from "@acme/ui/drawer";
import { cn } from "@acme/ui/utils";
import { RiSparkling2Fill } from "react-icons/ri";
import {
  ChatUnreadA11yHint,
  ChatUnreadBadge,
} from "~/components/chat/chat-unread-badge";
import { useChatUnread } from "~/components/chat/use-chat-unread";

type ChatDrawerTriggerProps = Omit<
  React.ComponentProps<typeof DrawerTrigger>,
  "children"
>;

export function ChatDrawerTrigger({
  className,
  ...props
}: ChatDrawerTriggerProps) {
  const { isOpen } = useDrawer();
  const { hasUnreadMessages } = useChatUnread(isOpen);

  return (
    <DrawerTrigger asChild>
      <Button
        aria-label="Ask Journl"
        aria-description={
          hasUnreadMessages ? "New assistant message" : undefined
        }
        size="lg"
        className={cn(
          "relative h-12 min-w-39 cursor-pointer rounded-full border bg-(--assistant) text-(--pastel-foreground) shadow-lg hover:bg-(--assistant)",
          hasUnreadMessages ? "animate-chat-trigger-wiggle" : undefined,
          className,
        )}
        {...props}
      >
        <RiSparkling2Fill className="size-5" />
        <span>Ask Journl</span>
        <ChatUnreadBadge hasUnreadMessages={hasUnreadMessages} />
        <ChatUnreadA11yHint hasUnreadMessages={hasUnreadMessages} />
      </Button>
    </DrawerTrigger>
  );
}
