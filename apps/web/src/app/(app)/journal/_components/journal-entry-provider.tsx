"use client";

import type { TimelineEntry } from "@acme/api";
import { type ComponentProps, createContext, useContext, useMemo } from "react";
import { cn } from "~/components/utils";
import { formatDate } from "~/lib/format-date";

type JournalEntryContextValue = {
  documentId: string | null;
  date: string;
  formattedDate: string;
  initialBlocks: Extract<TimelineEntry, { document: unknown }>["document"];
  isToday: boolean;
};

const JournalEntryContext = createContext<JournalEntryContextValue | undefined>(
  undefined,
);

type JournalEntryProviderProps = ComponentProps<"div"> & {
  entry: TimelineEntry;
};

export function JournalEntryProvider({
  className,
  children,
  entry,
  ...rest
}: JournalEntryProviderProps) {
  const value = useMemo(() => {
    const date = new Date(`${entry.date}T00:00:00`);
    const now = new Date();
    const isToday =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
    const formattedDate = formatDate(date);
    return {
      date: entry.date,
      documentId: "document_id" in entry ? entry.document_id : null,
      formattedDate,
      initialBlocks: "document" in entry ? entry.document : undefined,
      isToday,
    };
  }, [entry]);

  return (
    <JournalEntryContext.Provider value={value}>
      <div
        className={cn(value.isToday && "min-h-96 md:min-h-124", className)}
        {...rest}
      >
        {children}
      </div>
    </JournalEntryContext.Provider>
  );
}

export function useJournalEntry() {
  const context = useContext(JournalEntryContext);
  if (!context) {
    throw new Error(
      "useJournalEntry must be used within a JournalEntryProvider",
    );
  }
  return context;
}
