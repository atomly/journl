"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import type { RouterOutputs } from "~/trpc";
import { useTRPC } from "~/trpc/react";

type BacklinkData = RouterOutputs["references"]["listBacklinks"];

export function ReferenceBacklinks({
  documentId,
  blockId,
}: {
  documentId: string;
  blockId?: string;
}) {
  const trpc = useTRPC();
  if (!trpc.references?.listBacklinks) return null;
  return (
    <ReferenceBacklinksContent blockId={blockId} documentId={documentId} />
  );
}

function ReferenceBacklinksContent({
  documentId,
  blockId,
}: {
  documentId: string;
  blockId?: string;
}) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [pageCache, setPageCache] = useState<{
    pages: Array<{ cursor?: string; data: BacklinkData }>;
    scope: string;
  }>({ pages: [], scope: "" });
  const scope = `${documentId}|${blockId ?? ""}`;
  const options = trpc.references.listBacklinks.queryOptions({
    blockId,
    cursor,
    documentId,
    limit: 20,
  });
  const query = useQuery({ ...options, enabled: open });
  useEffect(() => {
    setCursor(undefined);
    setPageCache({ pages: [], scope });
  }, [scope]);
  useEffect(() => {
    if (!query.data) return;
    setPageCache((previous) => {
      if (previous.scope !== scope || !cursor) {
        return { pages: [{ cursor, data: query.data }], scope };
      }
      const existingPage = previous.pages.findIndex(
        (page) => page.cursor === cursor,
      );
      if (existingPage >= 0) {
        const pages = [...previous.pages];
        pages[existingPage] = { cursor, data: query.data };
        return { pages, scope };
      }
      return {
        pages: [...previous.pages, { cursor, data: query.data }],
        scope,
      };
    });
  }, [cursor, query.data, scope]);
  const pages = pageCache.scope === scope ? pageCache.pages : [];
  const items = [
    ...new Map(
      pages
        .flatMap((page) => page.data.items)
        .map((item) => [item.documentId, item]),
    ).values(),
  ];
  const nextCursor = pages.at(-1)?.data.nextCursor;

  return (
    <section className="mx-auto my-6 w-full max-w-4xl rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="font-medium focus-visible:outline-2 focus-visible:outline-ring"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          Referenced by
        </button>
        <Button variant="outline" size="sm" asChild>
          <Link
            href={`/graph?documentId=${documentId}${blockId ? `&blockId=${blockId}` : ""}`}
          >
            Open graph
          </Link>
        </Button>
      </div>
      {open && (
        <div className="mt-3">
          {query.isPending ? (
            <p className="text-muted-foreground text-sm">Loading references…</p>
          ) : query.error ? (
            <p className="text-muted-foreground text-sm">
              References could not be loaded.
            </p>
          ) : items.length ? (
            <ul className="space-y-3">
              {items.map((source) => (
                <li
                  key={source.documentId}
                  className="border-t pt-3 first:border-0 first:pt-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      className="font-medium underline-offset-4 hover:underline"
                      href={source.href}
                    >
                      {source.title}
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {source.occurrenceCount} reference
                      {source.occurrenceCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <ul className="mt-1 space-y-1">
                    {source.snippets.map((snippet) => (
                      <li key={`${snippet.sourceBlockId}-${snippet.snippet}`}>
                        <Link
                          className="block truncate text-muted-foreground text-sm hover:text-foreground"
                          href={snippet.href}
                        >
                          {snippet.snippet || "Open source block"}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              No saved references point here yet.
            </p>
          )}
          {nextCursor && (
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              onClick={() => setCursor(nextCursor)}
            >
              Load more backlinks
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
