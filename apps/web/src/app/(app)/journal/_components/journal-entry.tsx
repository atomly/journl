"use client";

import type { JournalEntry } from "@acme/db/schema";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import type { PlaceholderJournalEntry } from "node_modules/@acme/api/src/router/journal";
import type React from "react";
import {
  type ComponentProps,
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";
import { useDebouncedCallback } from "use-debounce";
import { FullHeightTextarea } from "~/components/ui/full-height-textarea";
import { cn } from "~/components/utils";
import { formatDate } from "~/lib/format-date";
import { useTRPC } from "~/trpc/react";

type JournalEntryContextValue = {
  date: string;
  formattedDate: string;
  isToday: boolean;
  content?: string;
};

const JournalEntryContext = createContext<JournalEntryContextValue | undefined>(
  undefined,
);

function useJournalEntry() {
  const context = useContext(JournalEntryContext);
  if (!context) {
    throw new Error(
      "useJournalEntry must be used within a JournalEntryProvider",
    );
  }
  return context;
}

type JournalEntryProviderProps = ComponentProps<"div"> & {
  entry: JournalEntry | PlaceholderJournalEntry;
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
      content: "content" in entry ? entry.content : "",
      date: entry.date,
      formattedDate,
      isToday,
    } satisfies JournalEntryContextValue;
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
    <div className={cn("mb-3", className)} {...rest}>
      <h2 className="font-semibold text-2xl text-muted-foreground">
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
      <div className="mt-[1ch] size-1.5 flex-shrink-0 rounded-full bg-muted-foreground/40" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

type JournalTextAreaProps = Omit<
  ComponentProps<"textarea">,
  "value" | "onChange"
> & {
  className?: string;
  debounceTime?: number;
};

export function JournalEntryTextArea({
  className,
  debounceTime = 150,
  ...rest
}: JournalTextAreaProps) {
  const trpc = useTRPC();
  const { mutate } = useMutation(trpc.journal.write.mutationOptions({}));
  const debouncedMutate = useDebouncedCallback(mutate, debounceTime);
  const { date, content: initialContent } = useJournalEntry();
  const [content, setContent] = useState(initialContent);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value);
    debouncedMutate({
      content: e.target.value,
      date,
    });
  }

  return (
    <FullHeightTextarea
      value={content}
      onChange={handleChange}
      className={cn(
        "!bg-transparent !ring-0 resize-none border-none p-0 leading-relaxed outline-none placeholder:text-muted-foreground/80",
        className,
      )}
      onInput={(e) => {
        const target = e.target as HTMLTextAreaElement;
        target.style.height = "0px";
        target.style.height = `${target.scrollHeight}px`;
      }}
      {...rest}
    />
  );
}
