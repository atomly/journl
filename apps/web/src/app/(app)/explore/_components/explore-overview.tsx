"use client";
import { useQuery } from "@tanstack/react-query";
import {
  Compass,
  List,
  Map as MapIcon,
  Maximize2,
  Minus,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { getExploreTitle } from "~/references/explore-graph";
import { exploreUpdatedLabel } from "~/references/explore-note-list";
import { useTRPC } from "~/trpc/react";
import { INITIAL_CAMERA } from "../../graph/_components/use-explore-camera";
import { useExploreState } from "./explore-state";
import { ThreadCard, ThreadMap } from "./thread-map";

export function ExploreOverview() {
  const trpc = useTRPC();
  const [view, setView] = useExploreState("overview", {
    camera: INITIAL_CAMERA,
    cursor: undefined as string | undefined,
    history: [] as (string | undefined)[],
    mode: "map" as "map" | "list",
    scroll: 0,
    search: "",
  });
  const [search, setSearch] = useState(view.search);
  const viewport = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  useEffect(() => {
    setSearch(view.search);
  }, [view.search]);
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setView((v) =>
          v.search === search
            ? v
            : { ...v, cursor: undefined, history: [], scroll: 0, search },
        ),
      250,
    );
    return () => clearTimeout(timer);
  }, [search, setView]);
  const query = useQuery(
    trpc.explore.listClusters.queryOptions(
      { cursor: view.cursor, limit: 12, search: view.search },
      { refetchInterval: (q) => (q.state.data?.refreshing ? 3000 : false) },
    ),
  );
  useEffect(() => {
    if (query.data?.restartRequired)
      setView((v) => ({ ...v, cursor: undefined, history: [] }));
  }, [query.data?.restartRequired, setView]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => setWidth(Math.max(280, element.clientWidth));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (viewport.current) viewport.current.scrollTop = view.scroll;
  }, [view.scroll]);
  const threads = query.data?.items ?? [];
  return (
    <main className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8">
      <header>
        <h1 className="font-semibold text-2xl">Pick up a thread</h1>
        <p className="mt-2 max-w-xl text-muted-foreground text-sm leading-relaxed">
          Find the notes and sources behind an idea, and follow where it leads.
        </p>
      </header>
      <section
        aria-label="Your threads"
        className="overflow-hidden rounded-2xl border"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
          <Input
            aria-label="Find a thread"
            placeholder="Find a thread"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 max-w-sm"
          />
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              className="pointer-coarse:size-11"
              aria-label="Map view"
              aria-pressed={view.mode === "map"}
              onClick={() => setView((v) => ({ ...v, mode: "map" }))}
            >
              <MapIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="pointer-coarse:size-11"
              aria-label="List view"
              aria-pressed={view.mode === "list"}
              onClick={() => setView((v) => ({ ...v, mode: "list" }))}
            >
              <List />
            </Button>
            {view.mode === "map" && (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="pointer-coarse:size-11"
                  aria-label="Zoom out"
                  onClick={() =>
                    setView((v) => ({
                      ...v,
                      camera: {
                        ...v.camera,
                        zoom: Math.max(0.75, v.camera.zoom - 0.25),
                      },
                    }))
                  }
                >
                  <Minus />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="pointer-coarse:size-11"
                  aria-label="Zoom in"
                  onClick={() =>
                    setView((v) => ({
                      ...v,
                      camera: {
                        ...v.camera,
                        zoom: Math.min(2, v.camera.zoom + 0.25),
                      },
                    }))
                  }
                >
                  <Plus />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="pointer-coarse:size-11"
                  aria-label="Fit threads"
                  onClick={() =>
                    setView((v) => ({
                      ...v,
                      camera: INITIAL_CAMERA,
                      scroll: 0,
                    }))
                  }
                >
                  <Maximize2 />
                </Button>
              </>
            )}
          </div>
        </div>
        <div
          ref={viewport}
          onScroll={(e) => {
            const scroll = e.currentTarget.scrollTop;
            setView((v) => ({ ...v, scroll }));
          }}
          className="h-[min(65dvh,40rem)] min-h-96 overflow-auto bg-card/20"
        >
          {query.isPending ? (
            <Skeleton className="m-4 h-80 rounded-xl" />
          ) : query.isError ? (
            <ExploreError retry={() => void query.refetch()} />
          ) : threads.length ? (
            view.mode === "map" ? (
              <ThreadMap
                threads={threads}
                width={width}
                camera={view.camera}
                onCamera={(camera) => setView((v) => ({ ...v, camera }))}
              />
            ) : (
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                {threads.map((thread) => (
                  <ThreadCard key={thread.id} thread={thread} />
                ))}
              </div>
            )
          ) : (
            <div className="flex min-h-96 flex-col items-center justify-center gap-3 p-6 text-center">
              <Compass className="size-7 text-muted-foreground" />
              <p className="font-medium">
                {view.search
                  ? "No threads match that name"
                  : query.data?.refreshing
                    ? "Organizing your notes"
                    : "Your next thread starts with a note"}
              </p>
              <p className="max-w-md text-muted-foreground text-sm">
                {view.search
                  ? "Try another name, or clear your search."
                  : "Explore a recent note below. References between notes and shared sources bring your threads together here."}
              </p>
            </div>
          )}
        </div>
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-t px-4 py-2">
          <p role="status" className="text-muted-foreground text-xs">
            {query.data?.refreshing
              ? "Updating your threads…"
              : `${query.data?.total ?? 0} threads`}{" "}
            · Groups reflect references in your notes
          </p>
          <PageButtons
            history={view.history}
            nextCursor={query.data?.nextCursor}
            busy={query.isFetching}
            onPrevious={() =>
              setView((v) => ({
                ...v,
                cursor: v.history.at(-1),
                history: v.history.slice(0, -1),
                scroll: 0,
              }))
            }
            onNext={() =>
              setView((v) => ({
                ...v,
                cursor: query.data?.nextCursor,
                history: [...v.history, v.cursor],
                scroll: 0,
              }))
            }
          />
        </div>
      </section>
      <RecentNotes />
    </main>
  );
}
export function ExploreError({ retry }: { retry(): void }) {
  return (
    <div
      role="alert"
      className="flex min-h-80 flex-col items-center justify-center gap-3 p-6"
    >
      <p>Could not load this exploration.</p>
      <Button variant="outline" onClick={retry}>
        Try again
      </Button>
    </div>
  );
}
export function PageButtons({
  history,
  nextCursor,
  busy,
  onPrevious,
  onNext,
}: {
  history: unknown[];
  nextCursor?: string;
  busy: boolean;
  onPrevious(): void;
  onNext(): void;
}) {
  return (
    <div className="flex gap-2">
      <Button
        variant="ghost"
        size="sm"
        disabled={!history.length || busy}
        onClick={onPrevious}
      >
        Previous
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={!nextCursor || busy}
        onClick={onNext}
      >
        Next
      </Button>
    </div>
  );
}
function RecentNotes() {
  const trpc = useTRPC();
  const [view, setView] = useExploreState("recent", {
    cursor: undefined as string | undefined,
    history: [] as (string | undefined)[],
    sort: "latest" as "latest" | "oldest",
    unlinkedOnly: false,
  });
  const query = useQuery(
    trpc.explore.listRecentNotes.queryOptions({
      cursor: view.cursor,
      limit: 8,
      sort: view.sort,
      unlinkedOnly: view.unlinkedOnly,
    }),
  );
  return (
    <section aria-label="Recent notes" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium">
            {view.unlinkedOnly ? "Unlinked notes" : "Recent notes"}
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Choose a note to follow its connections.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={view.unlinkedOnly}
              onChange={(e) =>
                setView((v) => ({
                  ...v,
                  cursor: undefined,
                  history: [],
                  unlinkedOnly: e.target.checked,
                }))
              }
            />
            Unlinked only
          </label>
          <select
            aria-label="Sort recent notes"
            value={view.sort}
            onChange={(e) =>
              setView((v) => ({
                ...v,
                cursor: undefined,
                history: [],
                sort: e.target.value as "latest" | "oldest",
              }))
            }
            className="min-h-11 rounded-lg border bg-background px-3"
          >
            <option value="latest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>
      {query.isPending ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : query.isError ? (
        <ExploreError retry={() => void query.refetch()} />
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {query.data.items.map((n) => (
              <Link
                key={n.id}
                href={`/explore/notes/${n.id}`}
                className="flex min-w-0 items-center justify-between gap-3 rounded-xl border px-4 py-3 hover:bg-accent/30 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="truncate text-sm">{getExploreTitle(n)}</span>
                <span className="shrink-0 text-muted-foreground text-xs">
                  {exploreUpdatedLabel(n.updatedAt)}
                </span>
              </Link>
            ))}
          </div>
          {!query.data.items.length && (
            <p className="py-6 text-muted-foreground text-sm">
              {view.unlinkedOnly
                ? "All your notes have references."
                : "Your notes will appear here."}
            </p>
          )}
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>
              {query.data.total} {query.data.total === 1 ? "note" : "notes"}
            </span>
            <PageButtons
              history={view.history}
              nextCursor={query.data.nextCursor}
              busy={query.isFetching}
              onPrevious={() =>
                setView((v) => ({
                  ...v,
                  cursor: v.history.at(-1),
                  history: v.history.slice(0, -1),
                }))
              }
              onNext={() =>
                setView((v) => ({
                  ...v,
                  cursor: query.data.nextCursor,
                  history: [...v.history, v.cursor],
                }))
              }
            />
          </div>
        </>
      )}
    </section>
  );
}
