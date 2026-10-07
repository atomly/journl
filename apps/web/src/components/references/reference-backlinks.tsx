"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { useTRPC } from "~/trpc/react";

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
  const options = trpc.references.listBacklinks.queryOptions({
    blockId,
    documentId,
    limit: 20,
  });
  const query = useQuery({ ...options, enabled: open });

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
          ) : query.data?.items.length ? (
            <ul className="space-y-3">
              {query.data.items.map((source) => (
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
        </div>
      )}
    </section>
  );
}
