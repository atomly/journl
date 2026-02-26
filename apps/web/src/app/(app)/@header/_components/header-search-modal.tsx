"use client";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Skeleton } from "~/components/ui/skeleton";
import { useIsMobile } from "~/hooks/use-mobile";
import { useTRPC } from "~/trpc/react";

const MIN_QUERY_LENGTH = 2;
const DEFAULT_THRESHOLD = 0.25;
const DEFAULT_LIMIT = 10;
const DEFAULT_DEBOUNCE_TIME = 150;

type HeaderSearchButtonProps = React.ComponentProps<typeof Dialog> & {
  children: React.ReactNode;
  limit?: number;
  threshold?: number;
  debounceTime?: number;
};

export function HeaderSearchButton({
  children,
  limit = DEFAULT_LIMIT,
  threshold = DEFAULT_THRESHOLD,
  debounceTime = DEFAULT_DEBOUNCE_TIME,
  ...rest
}: HeaderSearchButtonProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
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
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className="gap-0 rounded-2xl border-4 border-muted bg-sidebar p-0"
        data-state="open"
        showCloseButton={false}
      >
        <Command className="bg-transparent p-0" shouldFilter={false}>
          <DialogHeader className="px-2 pt-2">
            <DialogTitle className="sr-only">
              Search pages and journal entries
            </DialogTitle>
            <div className="flex w-full items-center gap-x-2 rounded-lg border-2 bg-muted px-2 [&>div]:w-full [&>div]:px-0">
              <CommandInput
                className="flex h-10 w-full rounded-md border-0 bg-transparent outline-none placeholder:text-muted-foreground focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Search notes..."
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                onValueChange={(value) => setQuery(value)}
              />
            </div>
          </DialogHeader>
          <ScrollArea>
            <CommandList className="p-4">
              <CommandEmpty className="flex h-full min-h-36 flex-col items-center justify-center py-2 text-center">
                {isLoading ? (
                  <div className="flex w-full flex-col gap-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : !notes ? (
                  <span className="text-muted-foreground text-sm">
                    {isError
                      ? "Something went wrong. Please try again later."
                      : "Write something to search."}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm">
                    No results found.
                  </span>
                )}
              </CommandEmpty>
              <CommandGroup
                className="p-0"
                heading={notes?.length ? "Results" : undefined}
              >
                {notes?.map((note) => {
                  const href =
                    note.type === "journal"
                      ? `/journal/${note.date}`
                      : `/pages/${note.id}`;
                  return (
                    <Link key={note.id} href={href}>
                      <CommandItem
                        className="my-1 grid cursor-pointer grid-cols-[1fr_auto] gap-2"
                        onSelect={() => {
                          setIsOpen(false);
                          router.push(href);
                        }}
                      >
                        <div className="grid gap-1">
                          {note.type === "page" ? (
                            <>
                              <div className="font-medium text-sm">
                                <HighlightedText query={query}>
                                  {note.header}
                                </HighlightedText>
                              </div>
                              <div className="line-clamp-2 text-muted-foreground text-sm">
                                <HighlightedText query={query} maxLength={120}>
                                  {note.content}
                                </HighlightedText>
                              </div>
                              <div className="text-muted-foreground text-xs">
                                Last updated{" "}
                                {new Date(note.updated_at).toLocaleDateString()}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="font-medium text-sm">
                                {new Date(note.date).toLocaleDateString()}
                              </div>
                              <div className="line-clamp-2 text-muted-foreground text-sm">
                                <HighlightedText query={query} maxLength={120}>
                                  {note.content}
                                </HighlightedText>
                              </div>
                            </>
                          )}
                        </div>
                        <Badge
                          variant="secondary"
                          className="self-start text-xs"
                        >
                          {note.type === "journal" ? "Journal" : "Page"}
                        </Badge>
                      </CommandItem>
                    </Link>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </ScrollArea>
        </Command>
        <DialogFooter className="flex flex-row items-center bg-muted p-1">
          {isMobile ? (
            <Button
              className="ms-auto bg-background py-1 text-background-foreground text-sm hover:bg-background/80 hover:text-background-foreground"
              onClick={() => setIsOpen(false)}
            >
              Close <X className="size-3" />
            </Button>
          ) : (
            <>
              <div className="flex items-center justify-center gap-x-1.5 py-1">
                <kbd className="flex h-5 select-none items-center rounded border bg-background px-1.5 font-medium font-mono text-lg text-muted-foreground">
                  ⏎
                </kbd>
                <span className="text-muted-foreground text-sm">
                  Go to your note
                </span>
              </div>
              <div className="flex-1" />
              <div className="flex items-center justify-center gap-x-1.5 py-1">
                <span className="text-muted-foreground text-sm">
                  To navigate
                </span>
                <div className="flex items-center gap-x-0.5">
                  <kbd className="flex h-5 select-none items-center rounded border bg-background px-1.5 font-medium font-mono text-lg text-muted-foreground">
                    ↑
                  </kbd>
                  <kbd className="flex h-5 select-none items-center rounded border bg-background px-1.5 font-medium font-mono text-lg text-muted-foreground">
                    ↓
                  </kbd>
                </div>
              </div>
            </>
          )}
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
            className="rounded-sm bg-accent font-semibold text-accent-foreground"
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
