"use client";
import { Alert, AlertDescription, AlertTitle } from "@acme/ui/alert";
import { Button } from "@acme/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@acme/ui/command";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@acme/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@acme/ui/field";
import { ScrollArea } from "@acme/ui/scroll-area";
import { Skeleton } from "@acme/ui/skeleton";
import { Surface } from "@acme/ui/surface";

import { useQuery } from "@tanstack/react-query";

import { XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import { useTRPC } from "~/trpc/react";
import { HeaderSearchTrigger } from "./header-search-trigger";

const MIN_QUERY_LENGTH = 2;
const DEFAULT_THRESHOLD = 0.25;
const DEFAULT_LIMIT = 10;
const DEFAULT_DEBOUNCE_TIME = 150;
const HEADER_SEARCH_DIALOG_CONTENT_ID = "header-search-dialog-content";

type HeaderSearchButtonProps = Omit<
  React.ComponentProps<typeof Dialog>,
  "children"
> & {
  limit?: number;
  threshold?: number;
  debounceTime?: number;
};

export function HeaderSearchButton({
  limit = DEFAULT_LIMIT,
  threshold = DEFAULT_THRESHOLD,
  debounceTime = DEFAULT_DEBOUNCE_TIME,
  ...rest
}: HeaderSearchButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [keyboardNavigation, setKeyboardNavigation] = useState(false);
  const router = useRouter();
  const [debouncedQuery] = useDebounce(query, debounceTime);

  // Keyboard shortcut handlers
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const trpc = useTRPC();
  const {
    data: notes,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    ...trpc.notes.getSimilarNotes.queryOptions({
      limit,
      query: debouncedQuery,
      threshold,
    }),
    enabled: debouncedQuery.length > MIN_QUERY_LENGTH,
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen} {...rest}>
      <DialogTrigger
        render={<HeaderSearchTrigger />}
        aria-controls={HEADER_SEARCH_DIALOG_CONTENT_ID}
      />
      <DialogContent
        id={HEADER_SEARCH_DIALOG_CONTENT_ID}
        className="max-w-[calc(100%-24px)] gap-0 overflow-hidden rounded-3xl border bg-card p-0 sm:max-w-[560px] min-[701px]:rounded-[20px]"
        data-state="open"
        data-shell-search
        showCloseButton={false}
      >
        <Command
          className="bg-transparent p-0"
          shouldFilter={false}
          data-keyboard-navigation={keyboardNavigation}
          onKeyDownCapture={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp")
              setKeyboardNavigation(true);
          }}
        >
          <Surface
            material="glass"
            className="flex min-h-[70px] items-center rounded-none border-x-0 border-t-0 px-4 py-4 pr-16 min-[701px]:min-h-[78px] min-[701px]:px-6 min-[701px]:py-6 min-[701px]:pr-16"
          >
            <DialogHeader className="text-left">
              <DialogTitle className="text-[22px] leading-[1.2] min-[701px]:text-2xl">
                Search your notebook
              </DialogTitle>
            </DialogHeader>
          </Surface>
          <FieldGroup className="px-4 pt-5 min-[701px]:px-6 min-[701px]:pt-6 [&_[data-slot=command-input-wrapper]]:p-0 [&_[data-slot=input-group]]:h-[50px]! [&_[data-slot=input-group]]:rounded-[12px]!">
            <Field>
              <FieldLabel htmlFor="notebook-search">Search notes</FieldLabel>
              <CommandInput
                value={query}
                id="notebook-search"
                className="h-12 min-w-0 flex-1 px-4 text-base"
                placeholder="Search notes..."
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                onValueChange={(value) => {
                  setQuery(value);
                  setKeyboardNavigation(false);
                }}
              />
            </Field>
          </FieldGroup>
          <ScrollArea>
            <CommandList className="p-4 min-[701px]:p-6">
              <CommandEmpty className="flex min-h-10 flex-col items-start justify-start py-2 text-left">
                {isLoading ? (
                  <div className="flex w-full flex-col gap-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-[88%]" />
                    <Skeleton className="h-4 w-[64%]" />
                  </div>
                ) : isError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Search couldn’t load</AlertTitle>
                    <AlertDescription>
                      Your notes are unchanged. Try again when your connection
                      is available.
                    </AlertDescription>
                    <Button onClick={() => void refetch()}>Try again</Button>
                  </Alert>
                ) : !notes ? (
                  <span className="text-muted-foreground text-sm">
                    Write something to search.
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm">
                    No results found.
                  </span>
                )}
              </CommandEmpty>
              <CommandGroup className="p-0">
                {notes?.map((note) => {
                  const href =
                    note.type === "journal"
                      ? `/journal/${note.date}`
                      : `/pages/${note.id}`;
                  return (
                    <Link key={note.id} href={href}>
                      <CommandItem
                        className="grid cursor-pointer grid-cols-1 gap-0 in-data-[slot=dialog-content]:rounded-none!"
                        onSelect={() => {
                          setIsOpen(false);
                          router.push(href);
                        }}
                      >
                        <div className="grid min-w-0 gap-1">
                          <div className="font-normal text-base leading-6">
                            {note.type === "page" ? (
                              <HighlightedText query={query}>
                                {note.header}
                              </HighlightedText>
                            ) : (
                              new Date(note.date).toLocaleDateString()
                            )}
                            {" · "}
                            {note.type === "journal" ? "Journal" : "Page"}
                          </div>
                          <div className="flex min-w-0 items-start justify-between gap-3 text-muted-foreground">
                            <div className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-[1.6]">
                              <HighlightedText query={query} maxLength={120}>
                                {note.content}
                              </HighlightedText>
                            </div>
                            {note.type === "page" && (
                              <time
                                dateTime={note.updated_at}
                                className="shrink-0 whitespace-nowrap text-[11px] leading-[1.9]"
                              >
                                Last updated{" "}
                                {new Date(note.updated_at).toLocaleDateString()}
                              </time>
                            )}
                          </div>
                        </div>
                      </CommandItem>
                    </Link>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </ScrollArea>
        </Command>
        <DialogClose
          aria-label="Close search"
          render={
            <Button
              variant="outline"
              size="icon"
              className="absolute top-2 right-3 size-13 rounded-full min-[701px]:top-3 min-[701px]:right-5"
            />
          }
        >
          <XIcon className="size-6" />
        </DialogClose>
        <DialogFooter className="m-0 flex flex-row items-center justify-between rounded-none border-t p-4">
          <span className="hidden text-muted-foreground text-xs min-[701px]:inline">
            ↑ ↓ navigate · Enter opens your note
          </span>
          <Button
            className="w-full min-[701px]:ml-auto min-[701px]:w-auto"
            onClick={() => setIsOpen(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type HighlightedTextProps = {
  children: string;
  query: string;
  maxLength?: number;
};

function HighlightedText({ children, query, maxLength }: HighlightedTextProps) {
  // Truncate text if maxLength is provided
  const displayText =
    maxLength && children.length > maxLength
      ? `${children.slice(0, maxLength)}...`
      : children;

  if (!query || query.length < MIN_QUERY_LENGTH) {
    return <>{displayText}</>;
  }

  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (queryWords.length === 0) {
    return <>{children}</>;
  }

  const regex = new RegExp(
    `(${queryWords
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")})`,
    "gi",
  );

  const parts = displayText.split(regex);

  return (
    <>
      {parts.map((part, index) => {
        const isMatch = queryWords.some(
          (word) => part.toLowerCase() === word.toLowerCase(),
        );
        return isMatch ? (
          <mark
            // biome-ignore lint/suspicious/noArrayIndexKey: <Using the `index` is fine here.>
            key={`${part}-${index}`}
            className="bg-transparent font-normal text-inherit"
          >
            {part}
          </mark>
        ) : (
          part
        );
      })}
    </>
  );
}
