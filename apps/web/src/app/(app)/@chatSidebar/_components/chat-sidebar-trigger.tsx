"use client";

import { RiSparkling2Fill } from "react-icons/ri";
import { useChatNudge } from "~/components/assistant-ui/use-chat-nudge";
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
  const {
    hasUnreadAssistantMessages,
    unreadAssistantMessages,
    unreadAssistantMessagesLabel,
  } = useChatNudge(open);

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
          <span className="sr-only">Toggle Chat Sidebar</span>
          {hasUnreadAssistantMessages ? (
            <span className="sr-only">
              {unreadAssistantMessages} unread assistant
              {unreadAssistantMessages > 1 ? " messages" : " message"}
            </span>
          ) : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent className="font-bold" side="top" align="center">
        Ask Journl...
      </TooltipContent>
    </Tooltip>
  );
}
