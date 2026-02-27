"use client";

import { RiSparkling2Fill } from "react-icons/ri";
import {
  ChatUnreadA11yHint,
  ChatUnreadBadge,
} from "~/components/assistant-ui/chat-unread-badge";
import { useChatUnread } from "~/components/assistant-ui/use-chat-unread";
import { Button } from "~/components/ui/button";
import { useSidebar } from "~/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/cn";

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
      <TooltipTrigger asChild>
        <Button
          data-sidebar="trigger"
          data-slot="sidebar-trigger"
          onClick={toggleSidebar}
          size="icon"
          className={cn(
            "relative size-10 cursor-pointer rounded-full border",
            hasUnreadMessages ? "animate-chat-trigger-wiggle" : undefined,
            className,
          )}
          {...props}
        >
          <RiSparkling2Fill className="size-6" />
          <ChatUnreadBadge
            hasUnreadMessages={hasUnreadMessages}
            className="bg-destructive"
          />
          <span className="sr-only">Toggle Chat Sidebar</span>
          <ChatUnreadA11yHint hasUnreadMessages={hasUnreadMessages} />
        </Button>
      </TooltipTrigger>
      <TooltipContent className="font-bold" side="top" align="center">
        Ask Journl...
      </TooltipContent>
    </Tooltip>
  );
}
