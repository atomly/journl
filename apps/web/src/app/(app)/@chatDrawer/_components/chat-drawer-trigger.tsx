"use client";

import { Button } from "@acme/ui/button";
import { DrawerTrigger, useDrawer } from "@acme/ui/drawer";
import { cn } from "@acme/ui/utils";
import { Sparkle } from "lucide-react";
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
        aria-label="Toggle Chat Drawer"
        variant="assistant"
        size="default"
        className={cn(
          "journl-agent-launcher relative h-11 cursor-pointer rounded-[22px] border-0 px-[15px] font-medium text-sm shadow-sm",
          hasUnreadMessages ? "animate-chat-trigger-wiggle" : undefined,
          className,
        )}
        {...props}
      >
        <Sparkle
          className="size-4"
          strokeWidth={1.7}
          data-icon="inline-start"
        />
        <span>Ask Journl</span>

        <ChatUnreadBadge hasUnreadMessages={hasUnreadMessages} />
        <span className="sr-only">Toggle Chat Drawer</span>
        <ChatUnreadA11yHint hasUnreadMessages={hasUnreadMessages} />
      </Button>
    </DrawerTrigger>
  );
}
