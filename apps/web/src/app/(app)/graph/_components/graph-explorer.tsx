"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Maximize2, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import type { RouterOutputs } from "~/trpc";
import { useTRPC } from "~/trpc/react";

type GraphData = RouterOutputs["references"]["getGraph"];
type GraphNode = GraphData["nodes"][number];

const WIDTH = 920;
const HEIGHT = 520;

function nodePosition(index: number, total: number) {
  if (total <= 1) return { x: WIDTH / 2, y: HEIGHT / 2 };
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  const radius = Math.min(WIDTH, HEIGHT) * 0.34;
  return {
    x: WIDTH / 2 + Math.cos(angle) * radius,
    y: HEIGHT / 2 + Math.sin(angle) * radius,
  };
}

function nodeColor(kind: GraphNode["kind"]) {
  switch (kind) {
    case "page":
      return "#3b82f6";
    case "journal":
      return "#10b981";
    case "block":
      return "#8b5cf6";
    case "external":
      return "#f59e0b";
    default:
      return "#94a3b8";
  }
}

export function GraphExplorer() {
  const trpc = useTRPC();
  const params = useSearchParams();
  const [seedDocumentId, setSeedDocumentId] = useState<string | undefined>(
    () => params.get("documentId") ?? undefined,
  );
  const [seedBlockId, setSeedBlockId] = useState<string | undefined>(
    () => params.get("blockId") ?? undefined,
  );
  const [cursor, setCursor] = useState<string | undefined>();
  const [showBlocks, setShowBlocks] = useState(true);
  const [showExternal, setShowExternal] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string>();
  const [nodeSearch, setNodeSearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  }>();
  const graphQuery = trpc.references.getGraph.queryOptions({
    cursor,
    limit: 200,
    seedBlockId,
    seedDocumentId,
    types: [
      "page",
      "journal",
      ...(showBlocks ? ["block" as const] : []),
      ...(showExternal ? ["external" as const] : []),
    ],
  });
  const { data, error, isPending, refetch } = useQuery(graphQuery);
  const nodes = data?.nodes ?? [];
  const edges = data?.edges ?? [];
  const selected = nodes.find((node) => node.key === selectedKey);
  const selectedDocumentId =
    selected?.target?.kind === "document"
      ? selected.target.documentId
      : undefined;
  const occurrencesQuery = useQuery({
    ...trpc.references.listOccurrences.queryOptions({
      blockId:
        selected?.target?.kind === "document"
          ? selected.target.blockId
          : undefined,
      direction: "outgoing",
      documentId: selectedDocumentId ?? "00000000-0000-4000-8000-000000000000",
      limit: 50,
    }),
    enabled: Boolean(selectedDocumentId),
  });
  const filteredNodes = nodes.filter((node) =>
    `${node.title} ${node.kind}`
      .toLowerCase()
      .includes(nodeSearch.trim().toLowerCase()),
  );
  const positions = useMemo(
    () =>
      new Map(
        nodes.map((node, index) => [
          node.key,
          nodePosition(index, nodes.length),
        ]),
      ),
    [nodes],
  );

  function openNode(node: GraphNode) {
    if (node.href && node.kind !== "unavailable")
      window.location.assign(node.href);
  }

  function expandNode(node: GraphNode) {
    if (node.target?.kind !== "document") return;
    setSeedDocumentId(node.target.documentId);
    setSeedBlockId(node.target.blockId);
    setCursor(undefined);
    setSelectedKey(undefined);
  }

  return (
    <main className="mx-auto flex h-full w-full max-w-7xl flex-col gap-4 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl">Knowledge graph</h1>
          <p className="text-muted-foreground text-sm">
            Explore direct references between your pages, journal entries,
            blocks, and external sources.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSeedDocumentId(undefined);
              setSeedBlockId(undefined);
              setCursor(undefined);
            }}
          >
            <RotateCcw aria-hidden="true" /> Reset
          </Button>
          <Button variant="outline" size="sm" onClick={() => setZoom(1)}>
            <Maximize2 aria-hidden="true" /> Fit
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-lg border bg-card p-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showBlocks}
            onChange={(event) => {
              setShowBlocks(event.target.checked);
              setCursor(undefined);
            }}
          />{" "}
          Block targets
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showExternal}
            onChange={(event) => {
              setShowExternal(event.target.checked);
              setCursor(undefined);
            }}
          />{" "}
          External links
        </label>
        <span className="text-muted-foreground" aria-live="polite">
          {data
            ? `${nodes.length} nodes · ${edges.length} connections${data.truncated ? " · results clipped" : ""}`
            : ""}
        </span>
      </div>

      {isPending ? (
        <Skeleton className="min-h-[440px] flex-1 rounded-xl" />
      ) : error ? (
        <section className="rounded-xl border p-8 text-center" role="alert">
          <p>Could not load the graph.</p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => void refetch()}
          >
            Retry
          </Button>
        </section>
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <section
            className="min-h-[440px] overflow-hidden rounded-xl border bg-card"
            aria-label="Interactive graph visualization"
          >
            <svg
              aria-label="Graph connections. Select a circle to inspect it; use Open to navigate."
              className="h-full min-h-[440px] w-full touch-none"
              role="img"
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              onPointerDown={(event) =>
                setDrag({
                  panX: pan.x,
                  panY: pan.y,
                  x: event.clientX,
                  y: event.clientY,
                })
              }
              onPointerMove={(event) => {
                if (drag)
                  setPan({
                    x: drag.panX + event.clientX - drag.x,
                    y: drag.panY + event.clientY - drag.y,
                  });
              }}
              onPointerUp={() => setDrag(undefined)}
              onPointerLeave={() => setDrag(undefined)}
              onWheel={(event) => {
                event.preventDefault();
                setZoom((current) =>
                  Math.max(0.5, Math.min(2.5, current - event.deltaY * 0.001)),
                );
              }}
            >
              <g
                transform={`translate(${pan.x} ${pan.y}) translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${zoom}) translate(${-WIDTH / 2} ${-HEIGHT / 2})`}
              >
                {edges.map((edge) => {
                  const from = positions.get(edge.fromKey);
                  const to = positions.get(edge.toKey);
                  if (!from || !to) return null;
                  return (
                    <line
                      key={`${edge.fromKey}|${edge.toKey}`}
                      x1={from.x}
                      x2={to.x}
                      y1={from.y}
                      y2={to.y}
                      stroke="currentColor"
                      strokeOpacity="0.28"
                      strokeWidth={Math.min(5, 1 + edge.occurrenceCount / 2)}
                    />
                  );
                })}
                {nodes.map((node) => {
                  const point = positions.get(node.key);
                  if (!point) return null;
                  const selectedNode = selectedKey === node.key;
                  return (
                    <a
                      key={node.key}
                      href={`#graph-node-${encodeURIComponent(node.key)}`}
                      aria-label={`Select ${node.title}`}
                      onClick={(event) => {
                        event.preventDefault();
                        setSelectedKey(node.key);
                      }}
                    >
                      <g>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={selectedNode ? 18 : 14}
                          fill={nodeColor(node.kind)}
                          stroke={selectedNode ? "currentColor" : "white"}
                          strokeWidth={selectedNode ? 4 : 2}
                        />
                        <text
                          x={point.x}
                          y={point.y + 33}
                          textAnchor="middle"
                          fontSize="12"
                          fill="currentColor"
                        >
                          {node.title.slice(0, 24)}
                        </text>
                      </g>
                    </a>
                  );
                })}
              </g>
            </svg>
          </section>

          <aside className="flex min-h-0 flex-col gap-3 rounded-xl border bg-card p-4">
            <h2 className="font-medium">
              {selected ? selected.title : "Graph contents"}
            </h2>
            {selected ? (
              <div className="flex gap-2">
                {selected.href && selected.kind !== "unavailable" && (
                  <Button size="sm" onClick={() => openNode(selected)}>
                    <ExternalLink aria-hidden="true" /> Open
                  </Button>
                )}
                {selected.target?.kind === "document" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => expandNode(selected)}
                  >
                    Expand
                  </Button>
                )}
              </div>
            ) : null}
            <h3 className="font-semibold text-muted-foreground text-xs uppercase">
              Nodes
            </h3>
            <Input
              aria-label="Search graph nodes"
              placeholder="Search nodes"
              value={nodeSearch}
              onChange={(event) => setNodeSearch(event.target.value)}
            />
            <ul
              className="min-h-0 flex-1 space-y-1 overflow-auto"
              aria-label="Searchable graph nodes"
            >
              {filteredNodes.map((node) => (
                <li key={node.key}>
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                    aria-current={selectedKey === node.key ? "true" : undefined}
                    onClick={() => setSelectedKey(node.key)}
                  >
                    <span
                      className="mr-2 inline-block size-2 rounded-full"
                      style={{ backgroundColor: nodeColor(node.kind) }}
                    />
                    <span>{node.title}</span>
                    <span className="ml-2 text-muted-foreground text-xs">
                      {node.kind}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <h3 className="font-semibold text-muted-foreground text-xs uppercase">
              Connections
            </h3>
            <ul
              className="max-h-40 space-y-1 overflow-auto"
              aria-label="Graph connections and provenance"
            >
              {edges.map((edge) => {
                const from = nodes.find((node) => node.key === edge.fromKey);
                const to = nodes.find((node) => node.key === edge.toKey);
                return (
                  <li key={`${edge.fromKey}|${edge.toKey}`} className="text-sm">
                    {from?.title ?? "Note"} →{" "}
                    {to?.title ?? "Content unavailable"}{" "}
                    <span className="text-muted-foreground">
                      ({edge.occurrenceCount})
                    </span>
                  </li>
                );
              })}
            </ul>
            {selectedDocumentId && (
              <>
                <h3 className="font-semibold text-muted-foreground text-xs uppercase">
                  Occurrence details
                </h3>
                {occurrencesQuery.isPending ? (
                  <p className="text-muted-foreground text-sm">
                    Loading source blocks…
                  </p>
                ) : occurrencesQuery.data?.items.length ? (
                  <ul className="max-h-40 space-y-2 overflow-auto">
                    {occurrencesQuery.data.items.map((occurrence) => (
                      <li
                        key={occurrence.id}
                        className="border-t pt-2 first:border-0 first:pt-0"
                      >
                        <p className="text-muted-foreground text-xs">
                          {occurrence.presentation} reference ·{" "}
                          {occurrence.sourceTitle ?? "Source note"}
                        </p>
                        {occurrence.sourceHref ? (
                          <Link
                            className="text-sm hover:underline"
                            href={occurrence.sourceHref}
                          >
                            {occurrence.snippet || "Open source block"}
                          </Link>
                        ) : (
                          <p className="text-sm">
                            {occurrence.snippet || "Open source block"}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No outgoing occurrences.
                  </p>
                )}
              </>
            )}
            {data?.nextCursor && (
              <Button
                variant="outline"
                onClick={() => setCursor(data.nextCursor ?? undefined)}
              >
                Load more nodes
              </Button>
            )}
            {seedDocumentId && (
              <Button variant="link" asChild>
                <Link href="/graph">Return to full graph</Link>
              </Button>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
