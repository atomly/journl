"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronRight,
  Compass,
  Maximize2,
  Minus,
  Plus,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebounce } from "use-debounce";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "~/components/ui/sheet";
import { Skeleton } from "~/components/ui/skeleton";
import { useIsMobile } from "~/hooks/use-mobile";
import {
  type ExploreEdge,
  type ExploreNode,
  getConnectedNotes,
  getExploreTitle,
  getNoteClusters,
  mergeGraphPages,
} from "~/references/explore-graph";
import { useTRPC } from "~/trpc/react";
import {
  type ExploreCamera,
  ExploreCanvas,
  INITIAL_CAMERA,
} from "./explore-canvas";
import { ExplorePreview, noteRoute } from "./explore-preview";

type Snapshot = {
  camera: ExploreCamera;
  selectedKey?: string;
  selectedEdge?: string;
  scrollTop: number;
};
type Step = { scope: string; href: string; title: string };
const OVERVIEW: Step = { href: "/graph", scope: "overview", title: "Explore" };

export function GraphExplorer() {
  const params = useSearchParams();
  const router = useRouter();
  const documentId = params.get("documentId") ?? undefined;
  const blockId = documentId ? (params.get("blockId") ?? undefined) : undefined;
  const scope = documentId ? `${documentId}:${blockId ?? ""}` : "overview";
  const snapshots = useRef(new Map<string, Snapshot>());
  const titles = useRef(new Map<string, string>());
  const [trail, setTrail] = useState<Step[]>([]);
  useEffect(() => {
    const href = documentId
      ? `/graph?documentId=${documentId}${blockId ? `&blockId=${blockId}` : ""}`
      : "/graph";
    setTrail((previous) => {
      const existing = previous.findIndex((step) => step.scope === scope);
      if (existing >= 0) return previous.slice(0, existing + 1);
      const step = {
        href,
        scope,
        title: titles.current.get(scope) ?? (documentId ? "Note" : "Explore"),
      };
      return documentId ? [...previous, step] : [OVERVIEW];
    });
  }, [scope, documentId, blockId]);
  const onTitle = useCallback(
    (title: string) => {
      titles.current.set(scope, title);
      setTrail((previous) =>
        previous.map((step) =>
          step.scope === scope && step.title !== title
            ? { ...step, title }
            : step,
        ),
      );
    },
    [scope],
  );
  function explore(node: ExploreNode) {
    if (node.target?.kind !== "document") return;
    const nextScope = `${node.target.documentId}:`;
    if (nextScope === scope) return;
    titles.current.set(nextScope, getExploreTitle(node));
    router.push(`/graph?documentId=${node.target.documentId}`);
  }
  return (
    <main className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-5 px-4 py-6 md:px-8">
      <div className="flex items-center gap-2">
        {trail.length > 1 && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="pointer-coarse:size-11"
            aria-label="Back to previous exploration"
            onClick={() => {
              const previous = trail.at(-2);
              if (previous) router.push(previous.href);
            }}
          >
            <ArrowLeft aria-hidden="true" />
          </Button>
        )}
        <nav
          aria-label="Exploration trail"
          className="flex min-w-0 flex-wrap items-center gap-1 text-sm"
        >
          {documentId && !trail.some((step) => step.scope === "overview") && (
            <>
              <Link
                href="/graph"
                className="inline-flex min-h-11 items-center rounded-md px-2 text-muted-foreground hover:text-foreground"
              >
                Explore
              </Link>
              <ChevronRight
                className="size-3 text-muted-foreground"
                aria-hidden="true"
              />
            </>
          )}
          {trail.map((step, index) => (
            <span key={step.scope} className="flex min-w-0 items-center gap-1">
              {index > 0 && (
                <ChevronRight
                  className="size-3 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              {index === trail.length - 1 ? (
                <span
                  aria-current="page"
                  className="max-w-56 truncate px-2 font-medium"
                >
                  {step.title}
                </span>
              ) : (
                <Link
                  href={step.href}
                  className="inline-flex min-h-11 max-w-48 items-center truncate rounded-md px-2 text-muted-foreground hover:text-foreground"
                >
                  {step.title}
                </Link>
              )}
            </span>
          ))}
        </nav>
      </div>
      <ExploreView
        key={scope}
        documentId={documentId}
        blockId={blockId}
        snapshot={snapshots.current.get(scope)}
        onSnapshot={(snapshot) => snapshots.current.set(scope, snapshot)}
        onTitle={onTitle}
        onExplore={explore}
      />
    </main>
  );
}

function ExploreView({
  documentId,
  blockId,
  snapshot,
  onSnapshot,
  onTitle,
  onExplore,
}: {
  documentId?: string;
  blockId?: string;
  snapshot?: Snapshot;
  onSnapshot(snapshot: Snapshot): void;
  onTitle(title: string): void;
  onExplore(node: ExploreNode): void;
}) {
  const trpc = useTRPC();
  const router = useRouter();
  const mobile = useIsMobile();
  const focusKey = documentId ? `document:${documentId}` : undefined;
  const [selectedKey, setSelectedKey] = useState(snapshot?.selectedKey);
  const [selectedEdge, setSelectedEdge] = useState(snapshot?.selectedEdge);
  const [camera, setCamera] = useState(snapshot?.camera ?? INITIAL_CAMERA);
  const viewport = useRef<HTMLDivElement>(null);
  const initialSnapshot = useRef(snapshot).current;
  const [width, setWidth] = useState(920);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [debouncedSearch] = useDebounce(search, 200);
  const searchRoot = useRef<HTMLFormElement>(null);
  const graphQuery = useInfiniteQuery(
    trpc.references.getGraph.infiniteQueryOptions(
      {
        limit: 200,
        seedBlockId: blockId,
        seedDocumentId: documentId,
        types: ["page", "journal", "external"],
      },
      { getNextPageParam: (page) => page.nextCursor ?? undefined },
    ),
  );
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = graphQuery;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !graphQuery.isError)
      void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, graphQuery.isError]);
  const graph = useMemo(
    () => mergeGraphPages(graphQuery.data?.pages ?? []),
    [graphQuery.data],
  );
  const { clusters, unlinked } = useMemo(() => getNoteClusters(graph), [graph]);
  const root = graph.nodes.find((node) => node.key === focusKey);
  const selected = graph.nodes.find((node) => node.key === selectedKey);
  const complete = !graphQuery.isPending && !hasNextPage;
  const rootTitle = root?.title;
  useEffect(() => {
    if (rootTitle) onTitle(rootTitle);
  }, [rootTitle, onTitle]);
  useEffect(() => {
    if (!complete) return;
    const element = viewport.current;
    if (!element) return;
    const measure = () => setWidth(Math.max(280, element.clientWidth));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [complete]);
  useEffect(() => {
    if (complete && viewport.current && initialSnapshot)
      viewport.current.scrollTop = initialSnapshot.scrollTop;
  }, [complete, initialSnapshot]);
  const saveSnapshot = useCallback(() => {
    if (!complete || !viewport.current) return;
    onSnapshot({
      camera,
      scrollTop: viewport.current.scrollTop,
      selectedEdge,
      selectedKey,
    });
  }, [complete, onSnapshot, camera, selectedKey, selectedEdge]);
  useEffect(() => {
    saveSnapshot();
  }, [saveSnapshot]);
  const searchQuery = useQuery(
    trpc.references.searchTargets.queryOptions(
      { limit: 8, query: debouncedSearch },
      { enabled: searchOpen },
    ),
  );
  const preview = selected ? (
    <ExplorePreview
      node={selected}
      graph={graph}
      focusKey={focusKey}
      selectedEdge={selectedEdge}
      onSelect={select}
      onExplore={onExplore}
      onOpen={(node) => {
        if (node.href) router.push(noteRoute(node.href));
      }}
    />
  ) : null;
  function select(node: ExploreNode, edge?: ExploreEdge) {
    setSelectedKey(node.key);
    setSelectedEdge(edge ? `${edge.fromKey}|${edge.toKey}` : undefined);
  }
  const connectionCount = focusKey
    ? getConnectedNotes(graph, focusKey).length
    : 0;
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="break-words font-semibold text-2xl">
            {root
              ? root.title
              : documentId
                ? "Explore this note"
                : "Pick up a thread"}
          </h1>
          <p className="mt-1 max-w-xl text-muted-foreground text-sm leading-relaxed">
            {documentId
              ? "Follow the notes that connect to this one. Select a note to see why it belongs here."
              : "Find a starting note and follow its connections to pick up where you left off."}
          </p>
          {root?.href && (
            <Link
              href={noteRoute(root.href)}
              className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-md text-muted-foreground text-sm hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" /> Back to note
            </Link>
          )}
        </div>
        <form
          aria-label="Find a starting note"
          onSubmit={(event) => event.preventDefault()}
          ref={searchRoot}
          className="relative w-full md:w-72"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setSearchOpen(false);
          }}
        >
          <label htmlFor="explore-search" className="sr-only">
            Find a starting note
          </label>
          <Search
            aria-hidden="true"
            className="absolute top-3 left-3 size-4 text-muted-foreground"
          />
          <Input
            id="explore-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setSearchOpen(false);
              if (event.key === "ArrowDown") {
                event.preventDefault();
                searchRoot.current
                  ?.querySelector<HTMLButtonElement>("[data-search-result]")
                  ?.focus();
              }
            }}
            placeholder="Find a note…"
            className="min-h-11 pl-9"
          />
          {searchOpen && (
            <section
              className="absolute top-full right-0 left-0 z-30 mt-2 max-h-80 overflow-auto rounded-xl border bg-popover p-2 shadow-lg"
              aria-label="Starting notes"
            >
              <p className="px-2 py-1 text-muted-foreground text-xs">
                {search.trim() ? "Matching notes" : "Recently edited"}
              </p>
              {searchQuery.isPending ? (
                <p className="p-3 text-muted-foreground text-sm">
                  Finding notes…
                </p>
              ) : searchQuery.isError ? (
                <p className="p-3 text-muted-foreground text-sm">
                  Could not search notes. Try again.
                </p>
              ) : !searchQuery.data?.items.length ? (
                <p className="p-3 text-muted-foreground text-sm">
                  No notes found.
                </p>
              ) : (
                searchQuery.data.items.map((item) => (
                  <button
                    key={item.documentId}
                    data-search-result
                    type="button"
                    className="flex min-h-11 w-full flex-col justify-center rounded-lg px-3 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                    onClick={() => {
                      setSearchOpen(false);
                      onExplore({
                        href: item.href,
                        key: `document:${item.documentId}`,
                        kind: item.kind,
                        target: {
                          documentId: item.documentId,
                          kind: "document",
                        },
                        title: getExploreTitle(item),
                      });
                    }}
                  >
                    <span className="line-clamp-2 text-sm">
                      {getExploreTitle(item)}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {item.kind === "journal" ? "Journal entry" : "Note"}
                    </span>
                  </button>
                ))
              )}
            </section>
          )}
        </form>
      </header>
      {graphQuery.isError ? (
        <section role="alert" className="rounded-xl border p-8 text-center">
          <p>Could not load your connections.</p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => void graphQuery.refetch()}
          >
            Try again
          </Button>
        </section>
      ) : !complete ? (
        <div>
          <Skeleton className="h-96 rounded-2xl" />
          <p className="mt-3 text-muted-foreground text-sm" role="status">
            Finding your connections…
          </p>
        </div>
      ) : (
        <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-5">
            <section
              className="overflow-hidden rounded-2xl border"
              aria-label="Explore connected notes"
            >
              <div className="flex min-h-14 items-center justify-between gap-3 border-b px-3 py-2">
                <p className="pl-1 text-muted-foreground text-xs">
                  {documentId
                    ? `${connectionCount} connected ${connectionCount === 1 ? "note" : "notes"}`
                    : `${clusters.length} ${clusters.length === 1 ? "thread" : "threads"}`}{" "}
                  · Select a note to read its context
                </p>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="pointer-coarse:size-11"
                    aria-label="Zoom out"
                    onClick={() =>
                      setCamera((previous) => ({
                        ...previous,
                        zoom: Math.max(0.75, previous.zoom - 0.25),
                      }))
                    }
                  >
                    <Minus aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="pointer-coarse:size-11"
                    aria-label="Zoom in"
                    onClick={() =>
                      setCamera((previous) => ({
                        ...previous,
                        zoom: Math.min(2, previous.zoom + 0.25),
                      }))
                    }
                  >
                    <Plus aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="pointer-coarse:size-11"
                    aria-label="Fit connected notes"
                    onClick={() => {
                      setCamera(INITIAL_CAMERA);
                      if (viewport.current) viewport.current.scrollTop = 0;
                    }}
                  >
                    <Maximize2 aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <div
                ref={viewport}
                onScroll={saveSnapshot}
                className="max-h-[70dvh] min-h-80 overflow-auto bg-card/30"
              >
                {!documentId && !clusters.length ? (
                  <div className="flex min-h-80 flex-col items-center justify-center gap-3 px-6 text-center">
                    <Compass
                      aria-hidden="true"
                      className="size-7 text-muted-foreground"
                    />
                    <p className="font-medium">
                      Your next thread starts with a note
                    </p>
                    <p className="max-w-sm text-muted-foreground text-sm">
                      Find a note above, or choose one below. Links between
                      notes will bring your threads together here.
                    </p>
                  </div>
                ) : (
                  <ExploreCanvas
                    graph={graph}
                    width={width}
                    focusKey={focusKey}
                    selectedKey={selectedKey}
                    camera={camera}
                    onCamera={setCamera}
                    onSelect={select}
                    onExplore={onExplore}
                  />
                )}
              </div>
            </section>
            {!documentId && unlinked.length > 0 && (
              <section aria-label="Unlinked notes" className="space-y-3">
                <div>
                  <h2 className="font-medium text-sm">Unlinked notes</h2>
                  <p className="mt-1 text-muted-foreground text-xs">
                    These notes have no links to other notes yet.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {unlinked.map((node) => (
                    <button
                      type="button"
                      key={node.key}
                      className="flex min-h-14 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                      onClick={() => select(node)}
                    >
                      <span className="line-clamp-2">{node.title}</span>
                      <ChevronRight
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
          <aside
            className="hidden max-h-[78dvh] self-start overflow-auto rounded-2xl border bg-card/30 md:block"
            aria-label="Connection context"
          >
            {preview ?? (
              <div className="space-y-3 p-6">
                <Compass
                  className="size-6 text-muted-foreground"
                  aria-hidden="true"
                />
                <h2 className="font-medium">Follow a thread</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Select a note to read a preview and the passages connecting it
                  to this thread.
                </p>
                {root && (
                  <button
                    type="button"
                    className="min-h-11 text-left font-medium text-sm hover:underline"
                    onClick={() => select(root)}
                  >
                    Preview the starting note →
                  </button>
                )}
              </div>
            )}
          </aside>
        </div>
      )}
      <Sheet
        open={mobile && Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedKey(undefined);
            setSelectedEdge(undefined);
          }
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-[78dvh] overflow-auto rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
          showCloseButton={false}
        >
          <SheetTitle className="sr-only">Note preview</SheetTitle>
          <SheetDescription className="sr-only">
            Read the note and the passages connecting it to this thread.
          </SheetDescription>
          <div className="absolute top-3 right-3 z-10">
            <Button
              size="icon-sm"
              className="pointer-coarse:size-11"
              variant="ghost"
              aria-label="Close note preview"
              onClick={() => setSelectedKey(undefined)}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
          {preview}
        </SheetContent>
      </Sheet>
    </>
  );
}
