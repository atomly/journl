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
        size="default"
        className={cn(
          "relative h-12 cursor-pointer rounded-full border px-5",
          hasUnreadMessages ? "animate-chat-trigger-wiggle" : undefined,
          className,
        )}
        {...props}
      >
        <RiSparkling2Fill data-icon="inline-start" />
        <span>Ask Journl</span>
        <ChatUnreadBadge hasUnreadMessages={hasUnreadMessages} />
        <span className="sr-only">Toggle Chat Drawer</span>
        <ChatUnreadA11yHint hasUnreadMessages={hasUnreadMessages} />
      </Button>
    </DrawerTrigger>
  );
}
