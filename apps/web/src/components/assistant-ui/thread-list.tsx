import {
  ThreadListItemPrimitive,
  ThreadListPrimitive,
} from "@assistant-ui/react";
import { ArchiveIcon, PlusIcon } from "lucide-react";

import { TooltipIconButton } from "~/components/assistant-ui/tooltip-icon-button";
import { Button } from "~/components/ui/button";

export function ThreadList() {
  return (
    <ThreadListPrimitive.Root className="flex flex-col items-stretch gap-1.5">
      <ThreadListNew />
      <ThreadListItems />
    </ThreadListPrimitive.Root>
  );
}

function ThreadListNew() {
  return (
    <ThreadListPrimitive.New asChild>
      <Button
        className="flex items-center justify-start gap-1 rounded-lg px-2.5 py-2 text-start hover:bg-muted data-[active]:bg-muted"
        variant="ghost"
      >
        <PlusIcon />
        New Thread
      </Button>
    </ThreadListPrimitive.New>
  );
}

function ThreadListItems() {
  return <ThreadListPrimitive.Items components={{ ThreadListItem }} />;
}

function ThreadListItem() {
  return (
    <ThreadListItemPrimitive.Root className="flex items-center gap-2 rounded-lg transition-all hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active]:bg-muted">
      <ThreadListItemPrimitive.Trigger className="flex-grow px-3 py-2 text-start">
        <ThreadListItemTitle />
      </ThreadListItemPrimitive.Trigger>
      <ThreadListItemArchive />
    </ThreadListItemPrimitive.Root>
  );
}

function ThreadListItemTitle() {
  return (
    <p className="text-sm">
      <ThreadListItemPrimitive.Title fallback="New Chat" />
    </p>
  );
}

function ThreadListItemArchive() {
  return (
    <ThreadListItemPrimitive.Archive asChild>
      <TooltipIconButton
        className="mr-3 ml-auto size-4 p-0 text-foreground hover:text-primary"
        variant="ghost"
        tooltip="Archive thread"
      >
        <ArchiveIcon />
      </TooltipIconButton>
    </ThreadListItemPrimitive.Archive>
  );
}
