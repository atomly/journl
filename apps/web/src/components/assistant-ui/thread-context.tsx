"use client";

import { useJournlAgent } from "~/ai/agents/use-journl-agent";
import { Badge } from "../ui/badge";
import { cn } from "../utils";

type ComposerContextProps = {
  className?: string;
};

export function ComposerContext({ className }: ComposerContextProps) {
  const { getView } = useJournlAgent();

  const view = getView();

  return (
    view.name !== "other" && (
      <Badge
        variant="outline"
        className={cn(
          className,
          "!justify-start group/source relative max-w-50 gap-x-1 border border-primary py-1 text-left",
        )}
      >
        {view.name === "journal-entry" && (
          <span className="truncate">Entry: {view.date}</span>
        )}
        {view.name === "journal" && (
          <span className="truncate">
            {view.focusedDate ? `Entry: ${view.focusedDate}` : "Journal"}
          </span>
        )}
        {view.name === "page" && (
          <span className="truncate">Page: {view.title}</span>
        )}
      </Badge>
    )
  );
}
