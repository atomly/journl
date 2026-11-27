"use client";

import { Button } from "@acme/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@acme/ui/tooltip";
import { cn } from "@acme/ui/utils";
import { Sparkle } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  ChatUnreadA11yHint,
  ChatUnreadBadge,
} from "~/components/chat/chat-unread-badge";
import { useChatUnread } from "~/components/chat/use-chat-unread";
import { useSidebar } from "~/components/ui/sidebar";

type ChatSidebarTriggerProps = Omit<
  React.ComponentProps<typeof Button>,
  "children" | "onClick" | "size"
>;

export default function ChatSidebarTrigger({
  className,
  ...props
}: ChatSidebarTriggerProps) {
  const { toggleSidebar, open } = useSidebar();
  const { hasUnreadMessages } = useChatUnread(open);

  const trigger = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open)
      trigger.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);
  if (open) return null;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            ref={trigger}
            aria-label="Toggle Chat Sidebar"
            variant="assistant"
            data-sidebar="trigger"
            data-slot="sidebar-trigger"
            onClick={toggleSidebar}
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

            <ChatUnreadBadge
              hasUnreadMessages={hasUnreadMessages}
              className="bg-destructive"
            />
            <span className="sr-only">Toggle Chat Sidebar</span>
            <ChatUnreadA11yHint hasUnreadMessages={hasUnreadMessages} />
          </Button>
        }
      />
      <TooltipContent className="font-bold" side="top" align="center">
        Open the assistant conversation
      </TooltipContent>
    </Tooltip>
  );
}
