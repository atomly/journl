"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { getExploreTitle } from "~/references/explore-graph";
import { useTRPC } from "~/trpc/react";
import { ExploreError, PageButtons } from "./explore-overview";
import { useExploreState } from "./explore-state";

export function ThreadItems({
  clusterId,
  snapshotId,
}: {
  clusterId: string;
  snapshotId: string | null;
}) {
  const trpc = useTRPC();
  const [why, setWhy] = useState<string>();
  const [view, setView] = useExploreState(
    `items:${clusterId}:${snapshotId ?? "pending"}`,
    {
      cursor: undefined as string | undefined,
      history: [] as (string | undefined)[],
      tab: "notes" as "notes" | "related" | "sources",
    },
  );
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
        <ExploreError
          retry={() => {
            if (view.cursor)
              setView((v) => ({ ...v, cursor: undefined, history: [] }));
            else void current.refetch();
          }}
        />
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

export function RelatedThreads({
  clusterId,
  snapshotId,
}: {
  clusterId: string;
  snapshotId: string | null;
}) {
  const trpc = useTRPC();
  const cache = useQueryClient();
  const [page, setPage] = useExploreState(
    `connections:${clusterId}:${snapshotId ?? "pending"}`,
    {
      cursor: undefined as string | undefined,
      history: [] as (string | undefined)[],
    },
  );
  const query = useQuery(
    trpc.explore.listThreadConnections.queryOptions({
      clusterId,
      cursor: page.cursor,
      limit: 20,
      snapshotId: snapshotId ?? undefined,
    }),
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: connections are derived from the newly published snapshot.
  useEffect(() => {
    void cache.invalidateQueries({
      queryKey: trpc.explore.listThreadConnections.pathKey(),
    });
  }, [snapshotId, clusterId, cache, trpc]);
  useEffect(() => {
    if (query.data?.restartRequired)
      setPage({ cursor: undefined, history: [] });
  }, [query.data?.restartRequired, setPage]);
  if (query.isPending) return <Skeleton className="h-24 rounded-xl" />;
  if (query.isError)
    return (
      <ExploreError
        retry={() => {
          if (page.cursor) setPage({ cursor: undefined, history: [] });
          else void query.refetch();
        }}
      />
    );
  if (!query.data?.total) return null;
  return (
    <section aria-label="Connected threads" className="space-y-2">
      <h2 className="font-medium text-sm">Where this thread leads</h2>
      <p className="text-muted-foreground text-xs">
        References written between notes in different threads.
      </p>
      <div className="flex flex-wrap gap-2">
        {query.data.items.map((thread) => (
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
      <PageButtons
        history={page.history}
        nextCursor={query.data.nextCursor}
        busy={query.isFetching}
        onPrevious={() =>
          setPage((v) => ({
            cursor: v.history.at(-1),
            history: v.history.slice(0, -1),
          }))
        }
        onNext={() =>
          setPage((v) => ({
            cursor: query.data.nextCursor,
            history: [...v.history, v.cursor],
          }))
        }
      />
    </section>
  );
}
