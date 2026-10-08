"use client";

import {
  CircleDot,
  FileText,
  GitPullRequest,
  Globe,
  NotebookPen,
} from "lucide-react";
import { useId, useState } from "react";
import {
  type ExploreEdge,
  type ExploreGraph,
  type ExploreNode,
  getConnectedNotes,
  layoutClusterGraph,
  layoutExploreGraph,
} from "~/references/explore-graph";

import { type ExploreCamera, useExploreCamera } from "./use-explore-camera";

export { type ExploreCamera, INITIAL_CAMERA } from "./use-explore-camera";

export function ExploreCanvas({
  graph,
  cluster = false,
  width,
  focusKey,
  selectedKey,
  camera,
  onCamera,
  onSelect,
  onExplore,
}: {
  graph: ExploreGraph;
  cluster?: boolean;
  width: number;
  focusKey?: string;
  selectedKey?: string;
  camera: ExploreCamera;
  onCamera(camera: ExploreCamera): void;
  onSelect(node: ExploreNode, edge?: ExploreEdge): void;
  onExplore(node: ExploreNode): void;
}) {
  const layout = cluster
    ? layoutClusterGraph(graph, width)
    : layoutExploreGraph(graph, width, focusKey);
  const gestures = useExploreCamera(camera, onCamera, width, layout.height);
  const visibleNodes = graph.nodes.filter((node) =>
    layout.positions.has(node.key),
  );
  const byKey = new Map(graph.nodes.map((node) => [node.key, node]));
  function selectEdge(edge: ExploreEdge) {
    const node = byKey.get(
      edge.fromKey === focusKey ? edge.toKey : edge.fromKey,
    );
    if (node) onSelect(node, edge);
  }
  return (
    <div className="relative">
      <svg
        aria-label={
          focusKey
            ? "Connected notes and sources. Select a note or connection to read its context."
            : "Connected note and source clusters. Select a note to preview it or explore a thread."
        }
        className="block w-full touch-none select-none"
        width={width}
        height={layout.height}
        viewBox={`0 0 ${width} ${layout.height}`}
        {...gestures}
      >
        <g
          transform={`translate(${width / 2 + camera.x} ${layout.height / 2 + camera.y}) scale(${camera.zoom}) translate(${-width / 2} ${-layout.height / 2})`}
        >
          {layout.groups.map((group) => (
            <g key={group.root.key}>
              <rect
                x={group.x}
                y={group.y}
                width={group.width}
                height={group.height}
                rx="16"
                fill="var(--muted)"
                fillOpacity="0.22"
                stroke="var(--border)"
                strokeOpacity="0.6"
              />
              <foreignObject
                x={group.x + 14}
                y={group.y + 10}
                width={group.width - 28}
                height="62"
              >
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-1 text-left focus-visible:outline-2 focus-visible:outline-ring"
                  onClick={() => onExplore(group.root)}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-sm">
                      {group.root.title}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {group.count} connected items
                    </span>
                  </span>
                  <span className="shrink-0 text-muted-foreground text-xs">
                    Explore →
                  </span>
                </button>
              </foreignObject>
            </g>
          ))}
          {graph.edges.map((edge) => {
            const from = layout.positions.get(edge.fromKey);
            const to = layout.positions.get(edge.toKey);
            if (!from || !to || edge.fromKey === edge.toKey) return null;
            const selected =
              selectedKey === edge.fromKey || selectedKey === edge.toKey;
            if (cluster && !selected) return null;
            const label = `Read connection between ${byKey.get(edge.fromKey)?.title} and ${byKey.get(edge.toKey)?.title}`;
            return (
              <g key={`${edge.fromKey}|${edge.toKey}`}>
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={
                    selected ? "var(--primary)" : "var(--muted-foreground)"
                  }
                  strokeOpacity={selected ? 0.65 : 0.25}
                  strokeWidth="1.5"
                />
                {/* biome-ignore lint/a11y/useSemanticElements: SVG connection hit areas support keyboard activation without covering note buttons. */}
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="transparent"
                  strokeWidth="16"
                  role="button"
                  tabIndex={0}
                  aria-label={label}
                  className="cursor-pointer outline-none focus-visible:stroke-ring/30"
                  onClick={() => selectEdge(edge)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectEdge(edge);
                    }
                  }}
                />
              </g>
            );
          })}
          {visibleNodes.map((node) => {
            const point = layout.positions.get(node.key);
            if (!point) return null;
            const focused = node.key === focusKey;
            const selected = node.key === selectedKey;
            const Icon =
              node.kind === "journal"
                ? NotebookPen
                : node.kind === "external"
                  ? node.href?.startsWith("https://github.com/") &&
                    node.href.includes("/pull/")
                    ? GitPullRequest
                    : node.href?.startsWith("https://github.com/") &&
                        node.href.includes("/issues/")
                      ? CircleDot
                      : Globe
                  : FileText;
            return (
              <foreignObject
                key={node.key}
                x={point.x - layout.cardWidth / 2}
                y={point.y - 34}
                width={layout.cardWidth}
                height="68"
              >
                <button
                  type="button"
                  aria-label={`Preview ${node.title}`}
                  aria-pressed={selected}
                  onClick={() => onSelect(node)}
                  className={`flex h-16 w-full flex-col justify-center gap-1 rounded-xl border px-3 text-left shadow-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring ${selected ? "border-primary bg-accent" : focused ? "border-primary/50 bg-card" : "border-border bg-card hover:bg-accent"}`}
                >
                  <span className="line-clamp-2 font-medium text-[13px] leading-4">
                    {node.title}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Icon aria-hidden="true" className="size-3" />
                    {focused
                      ? "Starting note"
                      : node.kind === "journal"
                        ? "Journal"
                        : node.kind === "external"
                          ? "Linked source"
                          : "Note"}
                  </span>
                </button>
              </foreignObject>
            );
          })}
        </g>
      </svg>
      {layout.hiddenCount > 0 && focusKey && (
        <CompleteConnections
          key={focusKey}
          nodes={getConnectedNotes(graph, focusKey)}
          onSelect={(node) =>
            onSelect(
              node,
              graph.edges.find(
                (edge) =>
                  (edge.fromKey === focusKey && edge.toKey === node.key) ||
                  (edge.toKey === focusKey && edge.fromKey === node.key),
              ),
            )
          }
        />
      )}
    </div>
  );
}

function CompleteConnections({
  nodes,
  onSelect,
}: {
  nodes: ExploreNode[];
  onSelect(node: ExploreNode): void;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return (
    <div className="px-4 pb-4">
      <div className="text-center">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={expanded ? id : undefined}
          className="min-h-11 rounded-lg px-3 text-muted-foreground text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded
            ? "Hide full connection list"
            : `See all connections (${nodes.length})`}
        </button>
      </div>
      {expanded && (
        <section
          id={id}
          aria-label="All connections"
          className="mt-2 max-h-80 overflow-y-auto overscroll-contain rounded-lg border border-border/70"
        >
          <ul className="divide-y divide-border/60">
            {nodes.map((node) => (
              <li key={node.key}>
                <button
                  type="button"
                  aria-label={`Read ${node.title}`}
                  className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]"
                  onClick={() => onSelect(node)}
                >
                  {node.kind === "external" ? (
                    <Globe
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                  ) : (
                    <FileText
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                  )}
                  <span className="min-w-0">
                    <span className="block break-words font-medium text-sm">
                      {node.title}
                    </span>
                    <span className="block text-muted-foreground text-xs">
                      {node.kind === "external"
                        ? "Linked source"
                        : node.kind === "journal"
                          ? "Journal"
                          : "Note"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
