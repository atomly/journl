"use client";

import { X } from "lucide-react";
import {
  type BlockSelection,
  useJournlAgentAwareness,
} from "~/ai/agents/use-journl-agent-awareness";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../utils";

type Source = {
  id: string;
  text: string;
  displayText: string;
  selection: BlockSelection;
};

type ComposerSourcesProps = {
  className?: string;
};

const MAX_SOURCES = 3;

export function ComposerSources({ className }: ComposerSourcesProps) {
  const { getSelections, forgetSelection } = useJournlAgentAwareness();

  const sources: Source[] = getSelections().map((selection) => {
    const { blockIds, text } = selection;
    return {
      displayText: text,
      id: Array.from(blockIds).join("-"),
      selection,
      text,
    };
  });

  const badges = sources.slice(0, MAX_SOURCES);
  const dropdown = sources.slice(MAX_SOURCES);

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {badges.map((source) => {
        return (
          <Badge
            variant="outline"
            className="!justify-start group/source relative max-w-30 gap-x-1 py-1 text-left"
            key={source.id}
          >
            {/* Text content with ellipsis */}
            <span className="truncate">{source.displayText}</span>
            {/* Remove button - only visible on hover, positioned over text */}
            <Button
              size="icon"
              variant="outline"
              onClick={() => forgetSelection(source.selection)}
              className="!bg-accent !text-accent-foreground !p-2 absolute right-1 bottom-1/2 flex size-3 translate-y-1/2 border-0 opacity-0 transition-opacity group-hover/source:opacity-100"
              aria-label="Remove selection"
            >
              <X className="size-4" />
            </Button>
          </Badge>
        );
      })}
      {dropdown.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button
              variant="outline"
              size="icon"
              className="h-6.5 w-auto rounded-md px-2 py-1 text-xs"
            >
              +{dropdown.length}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="z-1600 space-y-2 p-2">
            <div className="text-muted-foreground text-xs">Selections</div>
            <ScrollArea className="flex h-full max-h-42 flex-col [&_div:has(button)]:space-y-1">
              {dropdown.map((source) => {
                return (
                  <DropdownMenuItem
                    className="!px-1 !py-1.5 h-auto w-full max-w-72 cursor-pointer justify-between gap-x-1.5 text-xs"
                    key={source.id}
                    // Prevent the dropdown from closing
                    onSelect={(e) => e.preventDefault()}
                    asChild
                  >
                    <Button
                      variant="outline"
                      onClick={() => forgetSelection(source.selection)}
                      aria-label="Remove selection"
                    >
                      <span className="truncate">{source.displayText}</span>
                      <X className="size-4" />
                    </Button>
                  </DropdownMenuItem>
                );
              })}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
