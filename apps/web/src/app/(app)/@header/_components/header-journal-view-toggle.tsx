"use client";

import { CalendarDays, List } from "lucide-react";
import { useAppPreferences } from "~/components/preferences/app-preferences-provider";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/cn";

export function HeaderJournalViewToggle() {
  const { preferences, updatePreferences } = useAppPreferences();
  const isEntriesOnly = preferences.journalTimelineView === "entries";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-pressed={isEntriesOnly}
      className={cn(
        "h-8 gap-1.5 px-2.5 font-medium text-xs",
        isEntriesOnly && "bg-accent text-accent-foreground",
      )}
      onClick={() =>
        updatePreferences({
          journalTimelineView: isEntriesOnly ? "timeline" : "entries",
        })
      }
    >
      {isEntriesOnly ? (
        <List className="size-3.5" />
      ) : (
        <CalendarDays className="size-3.5" />
      )}
      <span>{isEntriesOnly ? "Entries" : "Timeline"}</span>
    </Button>
  );
}
