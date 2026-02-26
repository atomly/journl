"use client";

import { CalendarDays, List } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAppPreferences } from "~/components/preferences/app-preferences-provider";
import { Button } from "~/components/ui/button";
import { useIsMobile } from "~/hooks/use-mobile";

export function HeaderJournalButton() {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const [formattedDate, setFormattedDate] = useState<string | null>(null);

  useEffect(() => {
    setFormattedDate(
      new Date().toLocaleDateString("en-US", {
        day: isMobile ? "2-digit" : "numeric",
        month: "long",
        weekday: isMobile ? undefined : "long",
        year: "numeric",
      }),
    );
  }, [isMobile]);

  if (pathname === "/journal") return <HeaderJournalViewToggle />;

  return (
    <div className="min-w-0">
      <Link href="/journal">
        <div className="truncate text-sm">{formattedDate ?? "Journal"}</div>
      </Link>
    </div>
  );
}

function HeaderJournalViewToggle() {
  const { preferences, updatePreferences } = useAppPreferences();
  const isEntriesOnly = preferences.journalTimelineView === "entries";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-pressed={isEntriesOnly}
      className="h-8 gap-1.5 px-2.5 font-medium text-xs"
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
