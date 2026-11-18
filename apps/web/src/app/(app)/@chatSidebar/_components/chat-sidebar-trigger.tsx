"use client";

import { Button } from "@acme/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@acme/ui/tooltip";
import { cn } from "@acme/ui/utils";
import { RiSparkling2Fill } from "react-icons/ri";
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

  if (open) return null;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label="Ask Journl"
            aria-description={
              hasUnreadMessages ? "New assistant message" : undefined
            }
            data-assistant-trigger
            data-sidebar="trigger"
            data-slot="sidebar-trigger"
            onClick={toggleSidebar}
            size="lg"
            className={cn(
              "relative h-12 min-w-39 cursor-pointer rounded-full border bg-(--assistant) px-5 text-(--pastel-foreground) shadow-lg hover:bg-(--assistant)",
              hasUnreadMessages ? "animate-chat-trigger-wiggle" : undefined,
              className,
            )}
            {...props}
          >
            <RiSparkling2Fill className="size-5" />
            <span>Ask Journl</span>
            <ChatUnreadBadge
              hasUnreadMessages={hasUnreadMessages}
              className="bg-destructive"
            />
            <ChatUnreadA11yHint hasUnreadMessages={hasUnreadMessages} />
          </Button>
        }
      />
      <TooltipContent className="font-bold" side="top" align="center">
        Ask Journl...
      </TooltipContent>
    </Tooltip>
  );
}
