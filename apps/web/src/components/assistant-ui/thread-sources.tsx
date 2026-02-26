"use client";

import { X } from "lucide-react";
import {
  type BlockSelection,
  useJournlAgent,
} from "~/ai/agents/use-journl-agent";
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

type ComposerContextProps = {
  className?: string;
};

const MAX_SOURCES = 3;

export function ComposerSources({ className }: ComposerContextProps) {
  const { getAllSelections: getSelections, unsetSelection } = useJournlAgent();

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

  if (!badges.length) return null;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {badges.map((source) => {
        return (
          <Badge
            variant="outline"
            className="!justify-start group/source relative max-w-44 gap-x-1.5 border-sidebar-border/80 bg-muted/95 py-1.5 pr-6 text-left text-xs"
            key={source.id}
          >
            {/* Text content with ellipsis */}
            <span className="truncate">{source.displayText}</span>
            {/* Remove button - only visible on hover, positioned over text */}
            <Button
              size="icon"
              variant="outline"
              onClick={() => unsetSelection(source.selection)}
              className="!bg-transparent !p-0 absolute top-1.5 right-1.5 flex size-4 border-0 text-muted-foreground opacity-0 transition-opacity group-hover/source:opacity-100"
              aria-label="Remove selection"
            >
              <X className="size-3" />
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
              className="h-6.5 w-auto rounded-md border-sidebar-border/80 bg-muted/95 px-2 py-1 text-xs"
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
                      onClick={() => unsetSelection(source.selection)}
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
