"use client";
import { Sparkles } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useSidebar } from "~/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

export default function ChatSidebarTrigger() {
  const { toggleSidebar, open } = useSidebar();

  if (open) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          data-sidebar="trigger"
          data-slot="sidebar-trigger"
          onClick={toggleSidebar}
          size="icon"
          className="fixed right-2 bottom-2 hidden size-10 cursor-pointer rounded-full border md:flex"
        >
          <Sparkles className="size-6" />
          <span className="sr-only">Toggle Chat Sidebar</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent className="font-bold" side="top" align="center">
        Open Journl assistant
      </TooltipContent>
    </Tooltip>
  );
}
