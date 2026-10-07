"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Compass } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
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
  const query = useQuery(options);
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
  const panelId = `references-${documentId}-${blockId ?? "document"}`;

  if (!items.length) return null;

  return (
    <section className="mx-auto mt-6 w-full max-w-4xl px-8 text-sm">
      <div className="flex min-h-11 items-center justify-between gap-3 border-border/60 border-t">
        <button
          type="button"
          className="flex min-h-11 min-w-0 items-center gap-2 rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <ChevronDown
            aria-hidden="true"
            className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          />
          <span className="font-medium">Referenced by</span>
          {items.length > 0 && (
            <span className="text-xs tabular-nums">
              {items.length}
              {nextCursor ? "+" : ""}
            </span>
          )}
        </button>
        {open && (
          <Link
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md text-muted-foreground text-xs hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            href={`/graph?documentId=${documentId}${blockId ? `&blockId=${blockId}` : ""}`}
          >
            <Compass aria-hidden="true" className="size-3.5" />
            Explore this note
          </Link>
        )}
      </div>
      {open && (
        <div className="pb-3 pl-6" id={panelId} aria-live="polite">
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
                  className="border-border/60 border-l-2 py-2 pl-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      className="min-w-0 truncate font-medium underline-offset-4 hover:underline"
                      href={source.href}
                    >
                      {source.title}
                    </Link>
                    <span className="shrink-0 text-muted-foreground text-xs">
                      {source.occurrenceCount} reference
                      {source.occurrenceCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {source.snippets.map((snippet) => (
                      <li key={`${snippet.sourceBlockId}-${snippet.snippet}`}>
                        <Link
                          className="block truncate text-muted-foreground text-xs hover:text-foreground"
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
            <button
              type="button"
              disabled={query.isFetching}
              className="mt-3 text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline"
              onClick={() => setCursor(nextCursor)}
            >
              {query.isFetching ? "Loading…" : "Load more backlinks"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
