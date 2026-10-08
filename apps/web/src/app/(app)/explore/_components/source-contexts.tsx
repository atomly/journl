"use client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { getExploreTitle } from "~/references/explore-graph";
import { useTRPC } from "~/trpc/react";
import { ExploreError, PageButtons } from "./explore-overview";
import { useExploreState } from "./explore-state";
export function SourceContexts({
  clusterId,
  targetKey,
}: {
  clusterId: string;
  targetKey: string;
}) {
  const trpc = useTRPC();
  const [view, setView] = useExploreState(`source:${clusterId}:${targetKey}`, {
    cursor: undefined as string | undefined,
    history: [] as (string | undefined)[],
  });
  const query = useQuery(
    trpc.explore.listSourceContexts.queryOptions({
      clusterId,
      cursor: view.cursor,
      key: targetKey,
      limit: 20,
    }),
  );
  useEffect(() => {
    if (query.data?.restartRequired)
      setView({ cursor: undefined, history: [] });
  }, [query.data?.restartRequired, setView]);
  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6">
      <Link
        href={`/explore/clusters/${clusterId}`}
        className="inline-flex min-h-11 items-center gap-2 text-muted-foreground text-sm"
      >
        <ArrowLeft className="size-4" />
        Back to thread
      </Link>
      <header>
        <h1 className="font-semibold text-2xl">Why you saved this source</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Passages that reference it in this thread.
        </p>
      </header>
      {query.isPending ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : query.isError ? (
        <ExploreError retry={() => void query.refetch()} />
      ) : (
        <>
          <div className="space-y-3">
            {query.data.items.map((item) => (
              <article
                key={item.blockId}
                className="space-y-3 rounded-xl border p-4"
              >
                <Link
                  href={`/explore/notes/${item.note.id}`}
                  className="font-medium text-sm hover:underline"
                >
                  {getExploreTitle(item.note)}
                </Link>
                <p className="break-words text-muted-foreground text-sm leading-relaxed">
                  {item.excerpt || "This block contains the saved source."}
                </p>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center text-primary text-sm"
                >
                  Open passage →
                </Link>
              </article>
            ))}
          </div>
          {!query.data.items.length && (
            <p className="text-muted-foreground text-sm">
              No passages remain in this thread for that source.
            </p>
          )}
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
        </>
      )}
    </main>
  );
}
