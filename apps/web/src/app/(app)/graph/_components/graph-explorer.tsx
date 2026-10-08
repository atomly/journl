"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronRight,
  Compass,
  Maximize2,
  Minus,
  Plus,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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
import {
  EXPLORE_NOTES_PAGE_SIZE,
  exploreUpdatedLabel,
  sortExploreNotes,
} from "~/references/explore-note-list";
import { useTRPC } from "~/trpc/react";
import { useExploreState } from "../../explore/_components/explore-state";
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
const OVERVIEW: Step = {
  href: "/explore",
  scope: "overview",
  title: "Explore",
};

export function GraphExplorer({
  documentId: suppliedDocumentId,
  parentClusterId,
}: {
  documentId?: string;
  parentClusterId?: string;
} = {}) {
  const params = useSearchParams();
  const router = useRouter();
  const documentId =
    suppliedDocumentId ?? params.get("documentId") ?? undefined;
  const blockId = documentId ? (params.get("blockId") ?? undefined) : undefined;
  const scope = documentId ? `${documentId}:${blockId ?? ""}` : "overview";
  const snapshots = useRef(new Map<string, Snapshot>());
  const titles = useRef(new Map<string, string>());
  const [trail, setTrail] = useState<Step[]>([]);
  useEffect(() => {
    const href = documentId
      ? `/explore/notes/${documentId}${blockId ? `?blockId=${blockId}` : ""}`
      : "/explore";
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
    router.push(`/explore/notes/${node.target.documentId}`);
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
                href="/explore"
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
          {parentClusterId && <OriginThread clusterId={parentClusterId} />}
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
  const [stored, setStored] = useExploreState<Snapshot>(
    `note:${documentId ?? "legacy-overview"}:${blockId ?? ""}`,
    snapshot ?? { camera: INITIAL_CAMERA, scrollTop: 0 },
  );
  const selectedKey = stored.selectedKey;
  const selectedEdge = stored.selectedEdge;
  const setSelectedKey = (selectedKey?: string) =>
    setStored((v) => ({ ...v, selectedKey }));
  const setSelectedEdge = (selectedEdge?: string) =>
    setStored((v) => ({ ...v, selectedEdge }));
  const [noteOrder, setNoteOrder] = useState<"latest" | "oldest">("latest");
  const [notePage, setNotePage] = useState(0);
  const unlinkedSection = useRef<HTMLElement>(null);
  const camera = stored.camera;
  const setCamera = useCallback(
    (next: ExploreCamera | ((previous: ExploreCamera) => ExploreCamera)) =>
      setStored((v) => ({
        ...v,
        camera: typeof next === "function" ? next(v.camera) : next,
      })),
    [setStored],
  );
  const viewport = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(920);
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
  const graph = useMemo(
    () => mergeGraphPages(graphQuery.data?.pages ?? []),
    [graphQuery.data],
  );
  const { clusters, unlinked } = useMemo(() => getNoteClusters(graph), [graph]);
  const orderedUnlinked = useMemo(
    () => sortExploreNotes(unlinked, noteOrder),
    [unlinked, noteOrder],
  );
  const notePageCount = Math.max(
    1,
    Math.ceil(orderedUnlinked.length / EXPLORE_NOTES_PAGE_SIZE),
  );
  const currentNotePage = Math.min(notePage, notePageCount - 1);
  const visibleUnlinked = orderedUnlinked.slice(
    currentNotePage * EXPLORE_NOTES_PAGE_SIZE,
    (currentNotePage + 1) * EXPLORE_NOTES_PAGE_SIZE,
  );
  const root = graph.nodes.find((node) => node.key === focusKey);
  const selected =
    graph.nodes.find((node) => node.key === selectedKey) ??
    (!mobile ? root : undefined);
  const complete = !graphQuery.isPending;
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
    if (complete && viewport.current)
      viewport.current.scrollTop = stored.scrollTop;
  }, [complete, stored.scrollTop]);
  const saveSnapshot = useCallback(() => {
    if (!complete || !viewport.current) return;
    const scrollTop = viewport.current.scrollTop;
    setStored((v) => (v.scrollTop === scrollTop ? v : { ...v, scrollTop }));
    onSnapshot({
      camera,
      scrollTop: viewport.current.scrollTop,
      selectedEdge,
      selectedKey,
    });
  }, [complete, onSnapshot, camera, selectedKey, selectedEdge, setStored]);
  useEffect(() => {
    saveSnapshot();
  }, [saveSnapshot]);
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
      {documentId && <NoteMemberships documentId={documentId} />}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="break-words font-semibold text-2xl">
            {root
              ? `Connections for ${root.title}`
              : documentId
                ? "Explore this note"
                : "Pick up a thread"}
          </h1>
          <p className="mt-1 max-w-xl text-muted-foreground text-sm leading-relaxed">
            {documentId
              ? "Follow the notes and sources that connect to this one. Select an item to see why it belongs here."
              : "Choose a thread below, or explore connections from any note to pick up where you left off."}
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
        <div
          className="grid min-w-0 gap-5 md:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]"
          aria-busy="true"
        >
          <Skeleton className="h-[calc(min(70dvh,42rem)+3.5rem)] min-h-94 rounded-2xl" />
          <Skeleton className="hidden h-80 rounded-2xl md:block" />
          <p className="sr-only" role="status">
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
                    ? `${connectionCount} ${hasNextPage ? "connections shown" : connectionCount === 1 ? "connection" : "connections"}`
                    : `${clusters.length} ${clusters.length === 1 ? "thread" : "threads"}`}{" "}
                  · Select a note or source to read its context
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
                className="h-[min(70dvh,42rem)] min-h-80 overflow-auto bg-card/30"
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
                      Choose a note below or open a note and explore its
                      connections. Links between notes will bring your threads
                      together here.
                    </p>
                  </div>
                ) : (
                  <ExploreCanvas
                    graph={graph}
                    width={width}
                    focusKey={focusKey}
                    selectedKey={selected?.key}
                    camera={camera}
                    onCamera={setCamera}
                    onSelect={select}
                    onExplore={onExplore}
                  />
                )}
              </div>
            </section>
            {hasNextPage && (
              <Button
                variant="outline"
                disabled={isFetchingNextPage}
                onClick={() => void fetchNextPage()}
              >
                Load more connections
              </Button>
            )}
            {!documentId && unlinked.length > 0 && (
              <section
                ref={unlinkedSection}
                aria-label="Unlinked notes"
                className="space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-medium text-sm">Unlinked notes</h2>
                    <p className="mt-1 text-muted-foreground text-xs">
                      Notes with no connections yet. Preview one or continue
                      exploring.
                    </p>
                  </div>
                  <Select
                    value={noteOrder}
                    onValueChange={(value) => {
                      if (value === "latest" || value === "oldest") {
                        setNoteOrder(value);
                        setNotePage(0);
                      }
                    }}
                  >
                    <SelectTrigger
                      aria-label="Sort unlinked notes"
                      className="min-h-11"
                    >
                      <SelectValue>
                        {noteOrder === "latest"
                          ? "Latest first"
                          : "Oldest first"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="latest">Latest first</SelectItem>
                      <SelectItem value="oldest">Oldest first</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <ul className="divide-y rounded-xl border">
                  {visibleUnlinked.map((node) => {
                    const updatedLabel = exploreUpdatedLabel(node.updatedAt);
                    return (
                      <li
                        key={node.key}
                        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2"
                      >
                        <button
                          type="button"
                          aria-label={`Preview ${node.title}`}
                          className="min-h-11 min-w-0 flex-1 rounded-md py-1 text-left hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
                          onClick={() => select(node)}
                        >
                          <span className="line-clamp-2 font-medium text-sm">
                            {node.title}
                          </span>
                          <span className="mt-1 block text-muted-foreground text-xs">
                            {node.kind === "journal" ? "Journal entry" : "Note"}
                            {updatedLabel && (
                              <>
                                {" "}
                                · Updated{" "}
                                <time dateTime={node.updatedAt}>
                                  {updatedLabel}
                                </time>
                              </>
                            )}
                          </span>
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-h-11 text-muted-foreground"
                          aria-label={`Explore connections for ${node.title}`}
                          onClick={() => onExplore(node)}
                        >
                          Explore connections{" "}
                          <ChevronRight aria-hidden="true" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p role="status" className="text-muted-foreground text-xs">
                    {currentNotePage * EXPLORE_NOTES_PAGE_SIZE + 1}–
                    {Math.min(
                      (currentNotePage + 1) * EXPLORE_NOTES_PAGE_SIZE,
                      orderedUnlinked.length,
                    )}{" "}
                    of {orderedUnlinked.length} notes
                  </p>
                  {notePageCount > 1 && (
                    <nav
                      aria-label="Unlinked notes pages"
                      className="flex items-center gap-2"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-11"
                        disabled={currentNotePage === 0}
                        onClick={() => {
                          setNotePage(currentNotePage - 1);
                          unlinkedSection.current?.scrollIntoView?.({
                            block: "start",
                          });
                        }}
                      >
                        Previous
                      </Button>
                      <span className="text-muted-foreground text-xs">
                        {currentNotePage + 1} / {notePageCount}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-11"
                        disabled={currentNotePage + 1 >= notePageCount}
                        onClick={() => {
                          setNotePage(currentNotePage + 1);
                          unlinkedSection.current?.scrollIntoView?.({
                            block: "start",
                          });
                        }}
                      >
                        Next
                      </Button>
                    </nav>
                  )}
                </div>
              </section>
            )}
          </div>
          <aside
            className="sticky top-[calc(var(--app-header-offset,0px)+1rem)] hidden max-h-[calc(100dvh-var(--app-header-offset,0px)-2rem)] self-start overflow-auto rounded-2xl border bg-card/30 md:block"
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
          className="h-[78dvh] max-h-[78dvh] overflow-hidden rounded-t-2xl pb-[env(safe-area-inset-bottom)] data-[side=bottom]:h-[78dvh]"
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
          <div
            key={selectedKey}
            className="min-h-0 flex-1 overflow-auto overscroll-contain"
          >
            {preview}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function NoteMemberships({ documentId }: { documentId: string }) {
  const trpc = useTRPC();
  const query = useQuery(trpc.explore.memberships.queryOptions({ documentId }));
  if (!query.data?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Threads</span>
      {query.data.map((c) => (
        <Link
          key={c.id}
          href={`/explore/clusters/${c.id}`}
          className="inline-flex min-h-11 items-center rounded-lg border px-3 hover:bg-accent/30"
        >
          {c.name ?? c.generatedName}
          {c.role === "related" ? " · Related" : ""}
        </Link>
      ))}
    </div>
  );
}

function OriginThread({ clusterId }: { clusterId: string }) {
  const trpc = useTRPC();
  const query = useQuery(trpc.explore.getCluster.queryOptions({ clusterId }));
  return (
    <>
      <Link
        href={`/explore/clusters/${clusterId}`}
        className="inline-flex min-h-11 max-w-48 items-center truncate rounded-md px-2 text-muted-foreground hover:text-foreground"
      >
        {query.data?.summary?.name ?? "Previous thread"}
      </Link>
      <ChevronRight
        className="size-3 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    </>
  );
}
