"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "~/components/utils";
import { useJournalEntry } from "./journal-entry-provider";

type JournalEntryWrapperProps = ComponentProps<"div">;

export function JournalEntryWrapper({
  className,
  children,
  ...rest
}: JournalEntryWrapperProps) {
  const { isToday } = useJournalEntry();

  return (
    <div
      className={cn(isToday && "min-h-96 md:min-h-124", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function JournalEntryLink({ className, ...rest }: ComponentProps<"a">) {
  const { date } = useJournalEntry();

  return (
    <Link
      className={cn("text-muted-foreground", className)}
      href={`/journal/${date}`}
      {...rest}
    />
  );
}

type JournalEntryHeaderProps = Omit<ComponentProps<"div">, "children"> & {
  forceDate?: boolean;
};

export function JournalEntryHeader({
  className,
  forceDate = false,
  ...rest
}: JournalEntryHeaderProps) {
  const { formattedDate, isToday } = useJournalEntry();

  return (
    <div className={cn("mb-6", className)} {...rest}>
      <h2 className="font-semibold text-5xl text-muted-foreground">
        {isToday && !forceDate ? "Today" : formattedDate}
      </h2>
    </div>
  );
}

type JournalEntryContentProps = ComponentProps<"div">;

export function JournalEntryContent({
  className,
  children,
  ...rest
}: JournalEntryContentProps) {
  return (
    <div className={cn("flex items-start gap-2", className)} {...rest}>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
