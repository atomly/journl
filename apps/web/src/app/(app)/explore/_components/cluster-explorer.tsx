"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ExternalLink,
  Maximize2,
  Minus,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
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
  getExploreTitle,
} from "~/references/explore-graph";
import { useTRPC } from "~/trpc/react";
import {
  ExploreCanvas,
  INITIAL_CAMERA,
} from "../../graph/_components/explore-canvas";
import {
  ExplorePreview,
  noteRoute,
} from "../../graph/_components/explore-preview";
import { ExploreError, PageButtons } from "./explore-overview";
import { useExploreState } from "./explore-state";

export function ClusterExplorer({ clusterId }: { clusterId: string }) {
  const trpc = useTRPC();
  const router = useRouter();
  const cache = useQueryClient();
  const mobile = useIsMobile();
  const [view, setView] = useExploreState(`cluster:${clusterId}`, {
    camera: INITIAL_CAMERA,
    edge: undefined as string | undefined,
    scroll: 0,
    selected: undefined as string | undefined,
  });
  const summary = useQuery(
    trpc.explore.getCluster.queryOptions(
      { clusterId },
      { refetchInterval: (q) => (q.state.data?.refreshing ? 3000 : false) },
    ),
  );
  const map = useQuery(
    trpc.explore.getClusterMap.queryOptions(
      { clusterId },
      { enabled: !!summary.data?.summary },
    ),
  );
  const [renameOpen, setRenameOpen] = useState(false);
  const [name, setName] = useState("");
  const rename = useMutation(
    trpc.explore.renameCluster.mutationOptions({
      onSuccess: async () => {
        setRenameOpen(false);
        await cache.invalidateQueries({ queryKey: trpc.explore.pathKey() });
      },
    }),
  );
  const viewport = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(780);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the viewport mounts after map loading, so attach the observer when its snapshot arrives.
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => setWidth(Math.max(280, element.clientWidth));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [map.data?.snapshotId]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: restore after the loading shell is replaced and when the saved scroll changes.
  useEffect(() => {
    if (viewport.current) viewport.current.scrollTop = view.scroll;
  }, [map.data?.snapshotId, view.scroll]);
  useEffect(() => {
    if (summary.data?.snapshotId)
      void cache.invalidateQueries({
        queryKey: trpc.explore.getClusterMap.queryKey({ clusterId }),
      });
  }, [summary.data?.snapshotId, cache, clusterId, trpc]);
  const graph = map.data?.graph ?? { edges: [], nodes: [] };
  const selected = graph.nodes.find((n) => n.key === view.selected);
  function select(node: ExploreNode, edge?: ExploreEdge) {
    setView((v) => ({
      ...v,
      edge: edge ? `${edge.fromKey}|${edge.toKey}` : undefined,
      selected: node.key,
    }));
  }
  function explore(node: ExploreNode) {
    if (node.target?.kind === "document")
      router.push(
        `/explore/notes/${node.target.documentId}?thread=${clusterId}`,
      );
  }
  const preview = selected ? (
    <ExplorePreview
      node={selected}
      graph={graph}
      selectedEdge={view.edge}
      onSelect={select}
      onExplore={explore}
      onOpen={(n) => {
        if (n.href) router.push(noteRoute(n.href));
      }}
    />
  ) : null;
  const thread = summary.data?.summary;
  return (
    <main className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-5 px-4 py-6 md:px-8">
      <nav
        aria-label="Exploration trail"
        className="flex items-center gap-2 text-sm"
      >
        <Link
          href="/explore"
          className="inline-flex min-h-11 items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Explore
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="truncate">
          {thread?.name ?? "Thread"}
        </span>
      </nav>
      {summary.isPending ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : summary.isError ? (
        <ExploreError retry={() => void summary.refetch()} />
      ) : !thread ? (
        <section className="rounded-2xl border p-6">
          <h1 className="font-semibold text-xl">This thread has changed</h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Its notes may now belong to other threads. Your notes remain
            available in Explore.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {summary.data.successors.map((s) => (
              <Link
                key={s.id}
                href={`/explore/clusters/${s.id}`}
                className="min-h-11 rounded-lg border p-3"
              >
                {s.name} →
              </Link>
            ))}
            <Link href="/explore" className="min-h-11 py-3 text-primary">
              Browse your threads →
            </Link>
          </div>
        </section>
      ) : (
        <>
          <header className="flex items-start justify-between gap-4">
            <div>
              <h1 className="break-words font-semibold text-2xl">
                {thread.name}
              </h1>
              <p className="mt-2 text-muted-foreground text-sm">
                {thread.primaryCount} notes · {thread.sourceCount} sources
                {thread.relatedCount > 0
                  ? ` · ${thread.relatedCount} related notes`
                  : ""}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="pointer-coarse:size-11"
              aria-label="Rename thread"
              onClick={() => {
                setName(thread.name);
                setRenameOpen(true);
              }}
            >
              <Pencil />
            </Button>
          </header>
          <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0 space-y-5">
              <section
                className="overflow-hidden rounded-2xl border"
                aria-label="Thread map"
              >
                <div className="flex min-h-14 items-center justify-between gap-3 border-b px-4">
                  <p className="text-muted-foreground text-xs">
                    Select a note or source to reveal its connections
                  </p>
                  <div className="flex shrink-0">
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
                      aria-label="Fit thread"
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
                  </div>
                </div>
                <div
                  ref={viewport}
                  onScroll={(e) => {
                    const scroll = e.currentTarget.scrollTop;
                    setView((v) => ({ ...v, scroll }));
                  }}
                  className="h-[min(65dvh,40rem)] min-h-80 overflow-auto bg-card/20"
                >
                  {map.isPending ? (
                    <Skeleton className="m-4 h-80 rounded-xl" />
                  ) : map.isError ? (
                    <ExploreError retry={() => void map.refetch()} />
                  ) : (
                    <ExploreCanvas
                      cluster
                      graph={graph}
                      width={width}
                      selectedKey={selected?.key}
                      camera={view.camera}
                      onCamera={(camera) => setView((v) => ({ ...v, camera }))}
                      onSelect={select}
                      onExplore={explore}
                    />
                  )}
                </div>
                <div className="border-t px-4 py-3 text-muted-foreground text-xs">
                  {map.data &&
                  (map.data.omittedNotes > 0 ||
                    map.data.omittedSources > 0 ||
                    map.data.hasMoreConnections)
                    ? "A selection is shown on the map. Browse every note and source below."
                    : "Lines show references written in your notes."}
                  {summary.data.refreshing && (
                    <span role="status"> Updating this thread…</span>
                  )}
                </div>
              </section>
              <RelatedThreads
                clusterId={clusterId}
                snapshotId={summary.data.snapshotId}
              />
              <ThreadItems
                clusterId={clusterId}
                snapshotId={summary.data.snapshotId}
              />
            </div>
            <aside className="hidden min-w-0 md:sticky md:top-24 md:block md:max-h-[calc(100dvh-7rem)] md:self-start md:overflow-auto md:rounded-2xl md:border">
              {preview ?? (
                <div className="p-5">
                  <h2 className="font-medium text-sm">Read the context</h2>
                  <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
                    Select a note or source to read the passages behind its
                    connections. Open a note to continue writing, or explore it
                    to follow another thread.
                  </p>
                </div>
              )}
            </aside>
          </div>
        </>
      )}
      <Sheet
        open={mobile && !!selected}
        onOpenChange={(open) => {
          if (!open) setView((v) => ({ ...v, selected: undefined }));
        }}
      >
        <SheetContent
          side="bottom"
          className="h-[78dvh] max-h-[78dvh] overflow-hidden rounded-t-2xl p-0"
        >
          <SheetTitle className="sr-only">Selected note or source</SheetTitle>
          <SheetDescription className="sr-only">
            Read its references and supporting passages.
          </SheetDescription>
          <div className="h-full overflow-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-3 right-3 pointer-coarse:size-11"
              aria-label="Close preview"
              onClick={() => setView((v) => ({ ...v, selected: undefined }))}
            >
              <X />
            </Button>
            {preview}
          </div>
        </SheetContent>
      </Sheet>
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogTitle>Rename thread</DialogTitle>
          <DialogDescription>
            Your name stays when the thread updates.
          </DialogDescription>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              rename.mutate({ clusterId, name });
            }}
          >
            <Input
              aria-label="Thread name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            {rename.isError && (
              <p role="alert" className="text-destructive text-sm">
                Could not rename this thread. Try again.
              </p>
            )}
            <Button type="submit" disabled={!name.trim() || rename.isPending}>
              Save name
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
function ThreadItems({
  clusterId,
  snapshotId,
}: {
  clusterId: string;
  snapshotId: string | null;
}) {
  const trpc = useTRPC();
  const [why, setWhy] = useState<string>();
  const [view, setView] = useExploreState(`items:${clusterId}`, {
    cursor: undefined as string | undefined,
    history: [] as (string | undefined)[],
    tab: "notes" as "notes" | "related" | "sources",
  });
  const notes = useQuery(
    trpc.explore.listClusterMembers.queryOptions(
      {
        clusterId,
        cursor: view.cursor,
        limit: 20,
        role: view.tab === "related" ? "related" : "primary",
      },
      { enabled: view.tab !== "sources" },
    ),
  );
  const sources = useQuery(
    trpc.explore.listClusterSources.queryOptions(
      { clusterId, cursor: view.cursor, limit: 20 },
      { enabled: view.tab === "sources" },
    ),
  );
  const current = view.tab === "sources" ? sources : notes;
  const cache = useQueryClient();
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new published snapshot invalidates both member lists.
  useEffect(() => {
    void cache.invalidateQueries({
      queryKey: trpc.explore.listClusterMembers.pathKey(),
    });
    void cache.invalidateQueries({
      queryKey: trpc.explore.listClusterSources.pathKey(),
    });
  }, [snapshotId, cache, trpc]);
  useEffect(() => {
    if (current.data?.restartRequired)
      setView((v) => ({ ...v, cursor: undefined, history: [] }));
  }, [current.data?.restartRequired, setView]);
  return (
    <section aria-label="All notes and sources" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["notes", "related", "sources"] as const).map((tab) => (
          <Button
            key={tab}
            variant={view.tab === tab ? "secondary" : "ghost"}
            aria-pressed={view.tab === tab}
            onClick={() => setView({ cursor: undefined, history: [], tab })}
          >
            {tab === "related"
              ? "Related notes"
              : tab === "notes"
                ? "Notes"
                : "Sources"}
          </Button>
        ))}
      </div>
      {view.tab === "related" && (
        <p className="text-muted-foreground text-sm">
          These notes reference, or are referenced by, multiple notes in this
          thread.
        </p>
      )}
      {current.isPending ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : current.isError ? (
        <ExploreError retry={() => void current.refetch()} />
      ) : (
        <>
          <div className="divide-y rounded-xl border">
            {view.tab === "sources"
              ? sources.data?.items.map((s) => (
                  <div
                    key={s.key}
                    className="flex min-w-0 items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-full items-center gap-2 text-sm hover:underline"
                      >
                        <span className="truncate">{s.title}</span>
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                      <p className="mt-1 text-muted-foreground text-xs">
                        Referenced in {s.documentCount}{" "}
                        {s.documentCount === 1 ? "note" : "notes"}
                      </p>
                    </div>
                    <Link
                      href={`/explore/clusters/${clusterId}/sources?key=${encodeURIComponent(s.key)}`}
                      className="inline-flex min-h-11 shrink-0 items-center text-primary text-xs"
                    >
                      Read context →
                    </Link>
                  </div>
                ))
              : notes.data?.items.map((n) => (
                  <article key={n.id} className="px-4 py-3">
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                      <Link
                        href={`/explore/notes/${n.id}?thread=${clusterId}`}
                        className="min-w-0 flex-1 truncate py-2 text-sm hover:underline"
                      >
                        {getExploreTitle(n)}
                      </Link>
                      {!!n.evidence?.length && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-h-11"
                          aria-expanded={why === n.id}
                          aria-controls={`evidence-${n.id}`}
                          onClick={() =>
                            setWhy(why === n.id ? undefined : n.id)
                          }
                        >
                          Why here?
                        </Button>
                      )}
                      <Link
                        href={n.href}
                        className="inline-flex min-h-11 items-center text-primary text-xs"
                      >
                        Open note →
                      </Link>
                    </div>
                    {why === n.id && (
                      <div
                        id={`evidence-${n.id}`}
                        className="mt-2 space-y-3 rounded-lg bg-muted/30 p-3"
                      >
                        <p className="text-muted-foreground text-xs">
                          {n.role === "related"
                            ? "References connect this note with several notes in the thread."
                            : n.evidence.some((e) => e.kind === "document")
                              ? "References written between notes support this grouping."
                              : "Shared sources support this grouping."}
                        </p>
                        {n.evidence.map((evidence) => (
                          <blockquote
                            key={evidence.id}
                            className="space-y-1 border-primary/30 border-l-2 pl-3"
                          >
                            <p className="break-words text-sm leading-relaxed">
                              {evidence.excerpt ||
                                "This block contains the reference."}
                            </p>
                            <Link
                              href={evidence.href}
                              className="inline-flex min-h-11 items-center text-primary text-xs"
                            >
                              Read passage →
                            </Link>
                          </blockquote>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
          </div>
          {!current.data?.items.length && (
            <p className="py-4 text-muted-foreground text-sm">
              {view.tab === "related"
                ? "No related notes outside this thread yet."
                : view.tab === "sources"
                  ? "This thread has no external sources."
                  : "No notes remain in this thread."}
            </p>
          )}
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>{current.data?.total ?? 0} items</span>
            <PageButtons
              history={view.history}
              nextCursor={current.data?.nextCursor}
              busy={current.isFetching}
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
                  cursor: current.data?.nextCursor,
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

function RelatedThreads({
  clusterId,
  snapshotId,
}: {
  clusterId: string;
  snapshotId: string | null;
}) {
  const trpc = useTRPC();
  const cache = useQueryClient();
  const query = useQuery(
    trpc.explore.listRelatedThreads.queryOptions({ clusterId }),
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: connections are derived from the newly published snapshot.
  useEffect(() => {
    void cache.invalidateQueries({
      queryKey: trpc.explore.listRelatedThreads.queryKey({ clusterId }),
    });
  }, [snapshotId, clusterId, cache, trpc]);
  if (!query.data?.length) return null;
  return (
    <section aria-label="Connected threads" className="space-y-2">
      <h2 className="font-medium text-sm">Where this thread leads</h2>
      <p className="text-muted-foreground text-xs">
        References written between notes in different threads.
      </p>
      <div className="flex flex-wrap gap-2">
        {query.data.map((thread) => (
          <Link
            key={thread.id}
            href={`/explore/clusters/${thread.id}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm hover:bg-accent/30"
          >
            {thread.name}
            <span className="text-muted-foreground text-xs">
              {thread.connections} references →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
