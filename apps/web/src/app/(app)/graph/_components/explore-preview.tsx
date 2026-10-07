"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  ExternalLink,
  FileText,
  NotebookPen,
} from "lucide-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  type ExploreEdge,
  type ExploreGraph,
  type ExploreNode,
  getExploreTitle,
  isNote,
} from "~/references/explore-graph";
import { useTRPC } from "~/trpc/react";

export function noteRoute(href: string) {
  const url = new URL(href, "https://journl.invalid");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function ExplorePreview({
  node,
  graph,
  focusKey,
  selectedEdge,
  onSelect,
  onExplore,
  onOpen,
}: {
  node: ExploreNode;
  graph: ExploreGraph;
  focusKey?: string;
  selectedEdge?: string;
  onSelect(node: ExploreNode, edge?: ExploreEdge): void;
  onExplore(node: ExploreNode): void;
  onOpen(node: ExploreNode): void;
}) {
  const trpc = useTRPC();
  const previewQuery = useQuery(
    trpc.references.getPreviews.queryOptions(
      { targets: node.target?.kind === "document" ? [node.target] : [] },
      { enabled: node.target?.kind === "document" },
    ),
  );
  const preview = previewQuery.data?.items[0]?.preview;
  const byKey = new Map(graph.nodes.map((item) => [item.key, item]));
  const connections = graph.edges
    .filter((edge) => edge.fromKey === node.key || edge.toKey === node.key)
    .sort(
      (a, b) =>
        Number(`${b.fromKey}|${b.toKey}` === selectedEdge) -
        Number(`${a.fromKey}|${a.toKey}` === selectedEdge),
    );
  const outgoing = connections.filter(
    (edge) =>
      edge.fromKey === node.key &&
      Boolean(
        byKey.get(edge.toKey) && isNote(byKey.get(edge.toKey) as ExploreNode),
      ),
  );
  const incoming = connections.filter(
    (edge) =>
      edge.toKey === node.key &&
      edge.fromKey !== node.key &&
      Boolean(
        byKey.get(edge.fromKey) &&
          isNote(byKey.get(edge.fromKey) as ExploreNode),
      ),
  );
  const external = connections.filter(
    (edge) =>
      edge.fromKey === node.key && byKey.get(edge.toKey)?.kind === "external",
  );
  const Icon = node.kind === "journal" ? NotebookPen : FileText;
  function connectionList(
    title: string,
    edges: ExploreEdge[],
    incomingLinks = false,
  ) {
    if (!edges.length) return null;
    return (
      <section className="space-y-2" aria-label={title}>
        <h3 className="font-medium text-muted-foreground text-xs">{title}</h3>
        {edges.map((edge) => {
          const other = byKey.get(incomingLinks ? edge.fromKey : edge.toKey);
          if (!other) return null;
          return (
            <div
              key={`${edge.fromKey}|${edge.toKey}`}
              className="rounded-xl border border-border/70 p-3"
            >
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md text-left font-medium text-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
                onClick={() => onSelect(other, edge)}
              >
                <span>{other.title}</span>
                <span
                  aria-hidden="true"
                  className="shrink-0 text-muted-foreground"
                >
                  →
                </span>
              </button>
              {edge.sources.slice(0, 1).map((source) => (
                <div key={source.blockId}>
                  {source.excerpt && (
                    <blockquote className="my-2 border-border border-l-2 pl-3 text-muted-foreground text-sm leading-relaxed">
                      {source.excerpt}
                    </blockquote>
                  )}
                  <Link
                    href={noteRoute(source.href)}
                    className="inline-flex min-h-11 items-center gap-1 rounded-md text-muted-foreground text-xs hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    Read passage{" "}
                    <ArrowUpRight className="size-3" aria-hidden="true" />
                  </Link>
                </div>
              ))}
              {edge.occurrenceCount > 1 && (
                <p className="text-muted-foreground text-xs">
                  {edge.occurrenceCount} saved references
                </p>
              )}
            </div>
          );
        })}
      </section>
    );
  }
  return (
    <section className="space-y-5 p-5" aria-label="Note preview">
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-muted-foreground text-xs">
          <Icon aria-hidden="true" className="size-3.5" />
          {node.kind === "journal" ? "Journal entry" : "Note"}
          {node.key === focusKey && " · Starting note"}
        </p>
        <h2 className="break-words pr-5 font-semibold text-lg leading-snug">
          {preview?.status === "ready"
            ? getExploreTitle({ ...node, title: preview.title || node.title })
            : node.title}
        </h2>
        {previewQuery.isPending && node.target?.kind === "document" ? (
          <Skeleton className="mt-3 h-12" />
        ) : preview?.status === "ready" && preview.excerpt ? (
          <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
            {preview.excerpt}
          </p>
        ) : null}
        {preview?.status === "unavailable" && (
          <p className="mt-3 text-muted-foreground text-sm">
            This note is no longer available.
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {node.href && (
          <Button className="min-h-11" size="sm" onClick={() => onOpen(node)}>
            Open note <ArrowUpRight aria-hidden="true" />
          </Button>
        )}
        {node.target?.kind === "document" && node.key !== focusKey && (
          <Button
            className="min-h-11"
            variant="outline"
            size="sm"
            onClick={() => onExplore(node)}
          >
            Explore connections
          </Button>
        )}
      </div>
      {focusKey && node.key !== focusKey && (
        <p className="text-muted-foreground text-xs">
          Showing connections in this thread. Explore this note to follow it
          further.
        </p>
      )}
      {connectionList("Referenced here", outgoing)}
      {connectionList("Links back here", incoming, true)}
      {external.length > 0 && (
        <section className="space-y-2" aria-label="Linked sources">
          <h3 className="font-medium text-muted-foreground text-xs">
            Linked sources
          </h3>
          {external.map((edge) => {
            const source = byKey.get(edge.toKey);
            return source?.href ? (
              <div
                key={source.key}
                className="rounded-xl border border-border/70 p-3"
              >
                <a
                  className="flex min-h-11 items-center gap-2 break-all text-sm hover:underline"
                  href={source.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {source.title}
                  <ExternalLink
                    aria-hidden="true"
                    className="size-3.5 shrink-0"
                  />
                </a>
                {edge.sources[0]?.excerpt && (
                  <p className="mt-2 text-muted-foreground text-sm">
                    {edge.sources[0].excerpt}
                  </p>
                )}
              </div>
            ) : null;
          })}
        </section>
      )}
      {!connections.length && (
        <p className="text-muted-foreground text-sm">
          No saved connections yet. Links to other notes will appear here.
        </p>
      )}
    </section>
  );
}
