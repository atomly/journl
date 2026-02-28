"use client";

import { RiSparkling2Fill } from "react-icons/ri";
import {
  ChatUnreadA11yHint,
  ChatUnreadBadge,
} from "~/components/assistant-ui/chat-unread-badge";
import { useChatUnread } from "~/components/assistant-ui/use-chat-unread";
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
  const { hasUnreadMessages } = useChatUnread(isOpen);

  return (
    <DrawerTrigger asChild>
      <Button
        size="icon"
        className={cn(
          "relative size-10 cursor-pointer rounded-full border",
          hasUnreadMessages ? "animate-chat-trigger-wiggle" : undefined,
          className,
        )}
        {...props}
      >
        <RiSparkling2Fill className="size-6" />
        <ChatUnreadBadge hasUnreadMessages={hasUnreadMessages} />
        <span className="sr-only">Toggle Chat Drawer</span>
        <ChatUnreadA11yHint hasUnreadMessages={hasUnreadMessages} />
      </Button>
    </DrawerTrigger>
  );
}
