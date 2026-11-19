"use client";

import { Button } from "@acme/ui/button";
import { DrawerTrigger, useDrawer } from "@acme/ui/drawer";
import { cn } from "@acme/ui/utils";
import { MessageSquare } from "lucide-react";
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
          "relative h-12 min-w-[156px] cursor-pointer rounded-full border border-white/40 px-5 shadow-[0_8px_24px_#1d164829]",
          hasUnreadMessages ? "animate-chat-trigger-wiggle" : undefined,
          className,
        )}
        {...props}
      >
        <MessageSquare
          className="size-5"
          strokeWidth={1.7}
          data-icon="inline-start"
        />
        <span>Ask Journl</span>
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full bg-pastel-foreground"
        />
        <ChatUnreadBadge hasUnreadMessages={hasUnreadMessages} />
        <span className="sr-only">Toggle Chat Drawer</span>
        <ChatUnreadA11yHint hasUnreadMessages={hasUnreadMessages} />
      </Button>
    </DrawerTrigger>
  );
}
