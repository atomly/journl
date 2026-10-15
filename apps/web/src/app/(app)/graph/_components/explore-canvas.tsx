"use client";

import {
  type Edge,
  Handle,
  type Node,
  type NodeProps,
  Position,
} from "@xyflow/react";
import {
  CircleDot,
  FileText,
  GitPullRequest,
  Globe,
  NotebookPen,
} from "lucide-react";
import { useId, useMemo, useState } from "react";
import {
  type ExploreEdge,
  type ExploreGraph,
  type ExploreNode,
  getConnectedNotes,
} from "~/references/explore-graph";
import { layoutExploreGraph } from "~/references/explore-layout";
import { type ExploreCamera, ExploreFlow } from "./explore-flow";

type NoteNode = Node<{ note: ExploreNode; focused: boolean }, "note">;
type ReferenceEdge = Edge<{ reference: ExploreEdge }>;
const nodeTypes = { note: NoteCard };

function NoteCard({
  data: { note, focused },
  selected,
  sourcePosition,
  targetPosition,
}: NodeProps<NoteNode>) {
  const Icon =
    note.kind === "journal"
      ? NotebookPen
      : note.kind === "external"
        ? note.href?.startsWith("https://github.com/") &&
          note.href.includes("/pull/")
          ? GitPullRequest
          : note.href?.startsWith("https://github.com/") &&
              note.href.includes("/issues/")
            ? CircleDot
            : Globe
        : FileText;
  return (
    <div
      className={`flex h-[68px] w-full flex-col justify-center gap-1 rounded-xl border px-3 text-left shadow-xs transition-colors ${selected ? "border-primary bg-accent" : focused ? "border-primary/50 bg-card" : "border-border bg-card hover:bg-accent"}`}
    >
      <Handle type="target" position={targetPosition ?? Position.Left} />
      <span className="line-clamp-2 font-medium text-[13px] leading-4">
        {note.title}
      </span>
      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Icon aria-hidden="true" className="size-3" />
        {focused
          ? "Starting note"
          : note.kind === "journal"
            ? "Journal"
            : note.kind === "external"
              ? "Linked source"
              : "Note"}
      </span>
      <Handle type="source" position={sourcePosition ?? Position.Right} />
    </div>
  );
}

export function ExploreCanvas({
  graph,
  cluster = false,
  width,
  focusKey,
  selectedKey,
  selectedEdgeKey,
  camera,
  onCamera,
  onSelect,
  onDeselect,
}: {
  graph: ExploreGraph;
  cluster?: boolean;
  width: number;
  focusKey?: string;
  selectedKey?: string;
  selectedEdgeKey?: string;
  camera: ExploreCamera;
  onCamera(camera: ExploreCamera): void;
  onSelect(node: ExploreNode, edge?: ExploreEdge): void;
  onDeselect?(): void;
}) {
  const layout = useMemo(
    () => layoutExploreGraph(graph, width, focusKey, cluster),
    [graph, width, focusKey, cluster],
  );
  const mobile = width < 640;
  const nodes: NoteNode[] = graph.nodes.flatMap((note) => {
    const position = layout.positions.get(note.key);
    return position
      ? [
          {
            ariaLabel: `Preview ${note.title}`,
            ariaRole: "button",
            data: { focused: note.key === focusKey, note },
            domAttributes: { "aria-pressed": note.key === selectedKey },
            height: 68,
            id: note.key,
            position,
            selected: note.key === selectedKey,
            sourcePosition: mobile ? Position.Bottom : Position.Right,
            targetPosition: mobile ? Position.Top : Position.Left,
            type: "note",
            width: layout.cardWidth,
          },
        ]
      : [];
  });
  const edges: ReferenceEdge[] = graph.edges.flatMap((reference) => {
    if (
      reference.fromKey === reference.toKey ||
      !layout.positions.has(reference.fromKey) ||
      !layout.positions.has(reference.toKey)
    )
      return [];
    const selected =
      selectedKey === reference.fromKey || selectedKey === reference.toKey;
    return [
      {
        ariaLabel: `Read connection between ${graph.nodes.find((node) => node.key === reference.fromKey)?.title} and ${graph.nodes.find((node) => node.key === reference.toKey)?.title}`,
        ariaRole: "button",
        data: { reference },
        hidden: cluster && !selected,
        id: `${reference.fromKey}|${reference.toKey}`,
        interactionWidth: 24,
        selected: selectedEdgeKey === `${reference.fromKey}|${reference.toKey}`,
        source: reference.fromKey,
        style: {
          opacity: selected ? 0.65 : 0.3,
          stroke: selected ? "var(--primary)" : "var(--muted-foreground)",
        },
        target: reference.toKey,
        type: "default",
      },
    ];
  });
  function selectEdge(edge: ExploreEdge) {
    const node = graph.nodes.find(
      (node) =>
        node.key === (edge.fromKey === focusKey ? edge.toKey : edge.fromKey),
    );
    if (node) onSelect(node, edge);
  }
  return (
    <div>
      <ExploreFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        width={width}
        initialVisibleCount={width < 640 ? 1 : undefined}
        camera={camera}
        onCamera={onCamera}
        label="Connected notes and sources. Select a note or connection to read its context."
        onDeselect={onDeselect}
        onSelect={(node) => onSelect(node.data.note)}
        onSelectEdge={(edge) => {
          if (edge.data) selectEdge(edge.data.reference);
        }}
      />
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
