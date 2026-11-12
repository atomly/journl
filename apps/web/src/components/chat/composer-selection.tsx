"use client";
import { Badge } from "@acme/ui/badge";
import { cn } from "@acme/ui/utils";
import { useSyncExternalStore } from "react";
import { useJournlAgent } from "~/hooks/use-journl-agent";

/** The edit scope comes from the live editor selection, not a second selection store. */
export function ComposerSources({ className }: { className?: string }) {
  const { getSelections, subscribe, getRevision } = useJournlAgent();
  useSyncExternalStore(subscribe, getRevision, getRevision);
  const selected = getSelections()[0]?.text;
  if (!selected) return null;
  return (
    <div className={cn("flex min-w-0", className)}>
      <Badge variant="outline" className="max-w-64 truncate" title={selected}>
        Selected text: {selected}
      </Badge>
    </div>
  );
}
