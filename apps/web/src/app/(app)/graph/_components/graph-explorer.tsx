"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Maximize2, Minus, Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
  const angle = index * 2.399963229728653;
  const radius = Math.sqrt((index + 0.5) / total);
  return {
    x: WIDTH / 2 + Math.cos(angle) * radius * WIDTH * 0.4,
    y: HEIGHT / 2 + Math.sin(angle) * radius * HEIGHT * 0.37,
  };
}

function nodeColor(kind: GraphNode["kind"]) {
  switch (kind) {
    case "page":
      return "var(--chart-1)";
    case "journal":
      return "var(--chart-2)";
    case "block":
      return "var(--primary)";
    case "external":
      return "var(--chart-3)";
    default:
      return "var(--muted-foreground)";
  }
}

export function GraphExplorer() {
  const trpc = useTRPC();
  const params = useSearchParams();
  const router = useRouter();
  const [seedDocumentId, setSeedDocumentId] = useState<string | undefined>(
    () => params.get("documentId") ?? undefined,
  );
  const [seedBlockId, setSeedBlockId] = useState<string | undefined>(
    () => params.get("blockId") ?? undefined,
  );
  const [cursor, setCursor] = useState<string | undefined>();
  const [previousCursors, setPreviousCursors] = useState<
    Array<string | undefined>
  >([]);
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
  const urlDocumentId = params.get("documentId") ?? undefined;
  const urlBlockId = params.get("blockId") ?? undefined;
  useEffect(() => {
    setSeedDocumentId(urlDocumentId);
    setSeedBlockId(urlBlockId);
    setCursor(undefined);
    setPreviousCursors([]);
    setSelectedKey(undefined);
  }, [urlDocumentId, urlBlockId]);
  const graphData = data;
  const nodes = graphData?.nodes ?? [];
  const edges = graphData?.edges ?? [];
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
    if (!node.href || node.kind === "unavailable") return;
    if (node.kind === "external")
      window.open(node.href, "_blank", "noopener,noreferrer");
    else {
      const route = new URL(node.href, window.location.origin);
      router.push(`${route.pathname}${route.search}${route.hash}`);
    }
  }

  function expandNode(node: GraphNode) {
    if (node.target?.kind !== "document") return;
    setSeedDocumentId(node.target.documentId);
    setSeedBlockId(node.target.blockId);
    setCursor(undefined);
    setSelectedKey(undefined);
    setPreviousCursors([]);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function resetGraph() {
    setSeedDocumentId(undefined);
    setSeedBlockId(undefined);
    setCursor(undefined);
    setPreviousCursors([]);
    setSelectedKey(undefined);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  return (
    <main className="mx-auto flex h-full w-full max-w-7xl flex-col gap-4 px-6 py-6 md:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl">Knowledge graph</h1>
          <p className="text-muted-foreground text-sm">
            Explore direct references between your pages, journal entries,
            blocks, and external sources.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={resetGraph}>
            <RotateCcw aria-hidden="true" /> Reset
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            <Maximize2 aria-hidden="true" /> Fit
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Zoom out"
            onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}
          >
            <Minus aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Zoom in"
            onClick={() => setZoom((value) => Math.min(2.5, value + 0.25))}
          >
            <Plus aria-hidden="true" />
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-x-5 gap-y-2 border-b pb-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showBlocks}
            onChange={(event) => {
              setShowBlocks(event.target.checked);
              setCursor(undefined);
              setPreviousCursors([]);
              setSelectedKey(undefined);
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
              setPreviousCursors([]);
              setSelectedKey(undefined);
            }}
          />{" "}
          External links
        </label>
        <span className="text-muted-foreground" aria-live="polite">
          {graphData
            ? `${nodes.length} nodes · ${edges.length} connections${graphData.truncated ? " · more results available" : ""}`
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
            {nodes.length === 0 ? (
              <div className="flex min-h-[440px] flex-col items-center justify-center gap-2 px-6 text-center">
                <p className="font-medium">No connections yet</p>
                <p className="max-w-sm text-muted-foreground text-sm">
                  Reference a note with [[ or paste a link into the editor to
                  start connecting your ideas.
                </p>
              </div>
            ) : (
              <svg
                aria-label="Graph connections. Select a circle to inspect it; use Open to navigate."
                className="h-full min-h-[440px] w-full touch-none"
                role="img"
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                onPointerDown={(event) => {
                  if ((event.target as Element).closest("a")) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDrag({
                    panX: pan.x,
                    panY: pan.y,
                    x: event.clientX,
                    y: event.clientY,
                  });
                }}
                onPointerMove={(event) => {
                  if (drag) {
                    const scale =
                      WIDTH / event.currentTarget.getBoundingClientRect().width;
                    setPan({
                      x: drag.panX + (event.clientX - drag.x) * scale,
                      y: drag.panY + (event.clientY - drag.y) * scale,
                    });
                  }
                }}
                onPointerUp={() => setDrag(undefined)}
                onPointerCancel={() => setDrag(undefined)}
                onWheel={(event) => {
                  event.preventDefault();
                  setZoom((current) =>
                    Math.max(
                      0.5,
                      Math.min(2.5, current - event.deltaY * 0.001),
                    ),
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
                            stroke={
                              selectedNode ? "var(--foreground)" : "var(--card)"
                            }
                            strokeWidth={selectedNode ? 4 : 2}
                          />
                          <title>
                            {node.title} · {node.kind}
                          </title>
                          {(nodes.length <= 30 || selectedNode) && (
                            <text
                              x={point.x}
                              y={point.y + 33}
                              textAnchor="middle"
                              fontSize="12"
                              fill="currentColor"
                            >
                              {node.title.slice(0, 24)}
                            </text>
                          )}
                        </g>
                      </a>
                    );
                  })}
                </g>
              </svg>
            )}
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
            {graphData?.nextCursor && (
              <Button
                variant="outline"
                onClick={() => {
                  setPreviousCursors((previous) => [...previous, cursor]);
                  setCursor(graphData.nextCursor ?? undefined);
                  setSelectedKey(undefined);
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
              >
                Next graph view
              </Button>
            )}
            {previousCursors.length > 0 && (
              <Button
                variant="ghost"
                onClick={() => {
                  setCursor(previousCursors.at(-1));
                  setPreviousCursors((previous) => previous.slice(0, -1));
                  setSelectedKey(undefined);
                }}
              >
                Previous graph view
              </Button>
            )}
            {seedDocumentId && (
              <Button variant="link" onClick={resetGraph}>
                Return to full graph
              </Button>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
