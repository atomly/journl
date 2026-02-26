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
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    const dayMs = 24 * 60 * 60 * 1000;
    let intervalId: number | undefined;

    function updateToday() {
      setToday(new Date());
    }

    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);

    const timeoutId = window.setTimeout(() => {
      updateToday();
      intervalId = window.setInterval(updateToday, dayMs);
    }, nextMidnight.getTime() - now.getTime());

    return () => {
      window.clearTimeout(timeoutId);

      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  const formattedDate = today.toLocaleDateString("en-US", {
    day: isMobile ? "2-digit" : "numeric",
    month: "long",
    weekday: isMobile ? undefined : "long",
    year: "numeric",
  });

  if (pathname === "/journal") return <HeaderJournalViewToggle />;

  return (
    <div className="min-w-0">
      <Link href="/journal">
        <div className="truncate text-sm">{formattedDate}</div>
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
