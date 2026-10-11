"use client";
import {
  type Edge,
  Handle,
  type Node,
  type NodeProps,
  Position,
} from "@xyflow/react";
import Link from "next/link";
import { useMemo } from "react";
import { getExploreTitle } from "~/references/explore-graph";
import { layoutMap } from "~/references/explore-layout";
import { exploreUpdatedLabel } from "~/references/explore-note-list";
import type { RouterOutputs } from "~/trpc";
import {
  type ExploreCamera,
  ExploreFlow,
} from "../../graph/_components/explore-flow";

type Thread = RouterOutputs["explore"]["listClusters"]["items"][number];
export function ThreadCard({
  thread,
  onSelect,
}: {
  thread: Thread;
  onSelect?: (id: string) => void;
}) {
  return (
    <div className="group flex h-full min-w-0 flex-col gap-3 rounded-2xl border border-border/70 bg-card/80 p-4 transition-colors hover:border-primary/60 hover:bg-accent/20 focus-visible:outline-2 focus-visible:outline-ring">
      <div>
        <h2 className="line-clamp-2 font-medium text-base">
          <button
            type="button"
            className="text-left hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
            onClick={() => onSelect?.(thread.id)}
            aria-label={`Show connections for ${thread.name}`}
          >
            {thread.name}
          </button>
        </h2>
        <p className="mt-1 text-muted-foreground text-xs">
          {thread.primaryCount} notes · {thread.sourceCount}{" "}
          {thread.sourceCount === 1 ? "source" : "sources"}
        </p>
      </div>
      <ul className="space-y-1.5 text-muted-foreground text-sm">
        {thread.representatives.slice(0, 3).map((n) => (
          <li key={n.id} className="truncate">
            <span className="mr-2 text-primary/60" aria-hidden="true">
              ·
            </span>
            {getExploreTitle(n)}
          </li>
        ))}
      </ul>
      <p className="mt-auto flex items-center justify-between gap-2 text-muted-foreground text-xs">
        <span>{exploreUpdatedLabel(thread.lastActivity)}</span>
        <Link
          href={`/explore/clusters/${thread.id}`}
          className="inline-flex min-h-11 items-center text-primary"
        >
          Explore thread →
        </Link>
      </p>
    </div>
  );
}

type ThreadNode = Node<
  { thread: Thread; linked: boolean; onSelect(id: string): void },
  "thread"
>;
const nodeTypes = { thread: MapThreadCard };
function MapThreadCard({
  data,
  selected,
  sourcePosition,
  targetPosition,
}: NodeProps<ThreadNode>) {
  return (
    <div
      className={`h-[230px] rounded-[2.5rem] border p-4 ${selected ? "border-primary bg-primary/10 ring-2 ring-primary/50" : data.linked ? "border-primary/50 bg-card" : "border-border/70 bg-card/60"}`}
    >
      <Handle type="target" position={targetPosition ?? Position.Left} />
      <h2 className="line-clamp-2 font-medium text-base">
        <button
          type="button"
          aria-pressed={selected}
          aria-label={`Show connections for ${data.thread.name}`}
          className="min-h-11 text-left focus-visible:outline-2 focus-visible:outline-ring"
          onClick={() => data.onSelect(data.thread.id)}
        >
          {data.thread.name}
        </button>
      </h2>
      <p className="text-muted-foreground text-xs">
        {data.thread.primaryCount} notes · {data.thread.sourceCount}{" "}
        {data.thread.sourceCount === 1 ? "source" : "sources"}
      </p>
      <ul className="mt-3 space-y-1 text-muted-foreground text-sm">
        {data.thread.representatives.slice(0, 3).map((note) => (
          <li key={note.id} className="truncate">
            <span aria-hidden="true" className="mr-2 text-primary">
              ·
            </span>
            {getExploreTitle(note)}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          {exploreUpdatedLabel(data.thread.lastActivity)}
        </span>
        <Link
          className="inline-flex min-h-11 items-center text-primary"
          href={`/explore/clusters/${data.thread.id}`}
        >
          Explore thread →
        </Link>
      </div>
      <Handle type="source" position={sourcePosition ?? Position.Right} />
    </div>
  );
}
export function ThreadMap({
  threads,
  width,
  camera,
  onCamera,
  selectedId,
  connections,
  onSelect,
  onDeselect,
}: {
  threads: Thread[];
  width: number;
  camera: ExploreCamera;
  onCamera(camera: ExploreCamera): void;
  selectedId?: string;
  connections: { id: string; connections: number }[];
  onDeselect?(): void;
  onSelect(id: string): void;
}) {
  const mobile = width < 640;
  const cardWidth = mobile ? 280 : 320;
  const positions = useMemo(
    () =>
      layoutMap(
        threads.map((thread) => ({
          height: 230,
          id: thread.id,
          width: cardWidth,
        })),
        [],
        // Unconnected cards are arranged perpendicular to the rank direction.
        mobile ? "LR" : "TB",
      ),
    [threads, cardWidth, mobile],
  );
  const nodes: ThreadNode[] = threads.map((thread) => ({
    ariaLabel: `Thread ${thread.name}`,
    data: {
      linked: connections.some((connection) => connection.id === thread.id),
      onSelect,
      thread,
    },
    height: 230,
    id: thread.id,
    position: positions.get(thread.id) ?? { x: 0, y: 0 },
    selected: selectedId === thread.id,
    sourcePosition: mobile ? Position.Bottom : Position.Right,
    targetPosition: mobile ? Position.Top : Position.Left,
    type: "thread",
    width: cardWidth,
  }));
  const edges: Edge[] = selectedId
    ? connections
        .filter(
          (connection) =>
            connection.id !== selectedId && positions.has(connection.id),
        )
        .map((connection) => ({
          ariaLabel: `${connection.connections} authored references`,
          id: `${selectedId}|${connection.id}`,
          source: selectedId,
          style: { stroke: "var(--primary)" },
          target: connection.id,
        }))
    : [];
  return (
    <ExploreFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      width={width}
      initialVisibleCount={mobile ? 1 : 3}
      camera={camera}
      onCamera={onCamera}
      label="Your threads. Select a thread to reveal its connections, then open it to read its notes."
      onDeselect={onDeselect}
      onSelect={(node) => onSelect(node.id)}
    />
  );
}
