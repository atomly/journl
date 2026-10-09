"use client";
import Link from "next/link";
import { getExploreTitle } from "~/references/explore-graph";
import { exploreUpdatedLabel } from "~/references/explore-note-list";
import type { RouterOutputs } from "~/trpc";
import {
  type ExploreCamera,
  useExploreCamera,
} from "../../graph/_components/use-explore-camera";

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
export function ThreadMap({
  threads,
  width,
  camera,
  onCamera,
  selectedId,
  connections,
  onSelect,
}: {
  threads: Thread[];
  width: number;
  camera: ExploreCamera;
  onCamera(camera: ExploreCamera): void;
  selectedId?: string;
  connections: { id: string; connections: number }[];
  onSelect(id: string): void;
}) {
  const columns = width >= 650 ? 2 : 1;
  const rowHeight = 280;
  const height = Math.max(
    400,
    Math.ceil(threads.length / columns) * rowHeight + 60,
  );
  const gestures = useExploreCamera(camera, onCamera, width, height);
  const cellWidth = (width - 48) / columns;
  const ordered = [...threads].sort((a, b) => a.id.localeCompare(b.id));
  const position = (index: number) => ({
    x: 24 + (index % columns) * cellWidth,
    y:
      30 +
      Math.floor(index / columns) * rowHeight +
      (columns > 1 && index % 2 ? 30 : 0),
  });
  const selectedIndex = ordered.findIndex((thread) => thread.id === selectedId);
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block w-full touch-none select-none"
      aria-label="Your threads. Select a thread to reveal its connections, then open it to read its notes."
      {...gestures}
    >
      <g
        transform={`translate(${width / 2 + camera.x} ${height / 2 + camera.y}) scale(${camera.zoom}) translate(${-width / 2} ${-height / 2})`}
      >
        {selectedIndex >= 0 &&
          connections.map((connection) => {
            const index = ordered.findIndex(
              (thread) => thread.id === connection.id,
            );
            if (index < 0) return null;
            const from = position(selectedIndex);
            const to = position(index);
            return (
              <line
                key={connection.id}
                x1={from.x + (cellWidth - 20) / 2}
                y1={from.y + 110}
                x2={to.x + (cellWidth - 20) / 2}
                y2={to.y + 110}
                stroke="var(--primary)"
                strokeWidth="2"
                opacity="0.55"
              >
                <title>{connection.connections} authored references</title>
              </line>
            );
          })}
        {ordered.map((thread, index) => {
          const point = position(index);
          const selected = selectedId === thread.id;
          const linked = connections.some(
            (connection) => connection.id === thread.id,
          );
          return (
            <foreignObject
              key={thread.id}
              x={point.x}
              y={point.y}
              width={cellWidth - 20}
              height={230}
            >
              <div
                className={`h-full rounded-[2.5rem] border p-4 ${selected ? "border-primary bg-primary/10 ring-2 ring-primary/50" : linked ? "border-primary/50 bg-card" : "border-border/70 bg-card/60"}`}
              >
                <h2 className="line-clamp-2 font-medium text-base">
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={`Show connections for ${thread.name}`}
                    onClick={() => onSelect(thread.id)}
                    className="min-h-11 text-left focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {thread.name}
                  </button>
                </h2>
                <p className="text-muted-foreground text-xs">
                  {thread.primaryCount} notes · {thread.sourceCount}{" "}
                  {thread.sourceCount === 1 ? "source" : "sources"}
                </p>
                <ul className="mt-3 space-y-1 text-muted-foreground text-sm">
                  {thread.representatives.slice(0, 3).map((note) => (
                    <li key={note.id} className="truncate">
                      <span aria-hidden className="mr-2 text-primary">
                        ·
                      </span>
                      {getExploreTitle(note)}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {exploreUpdatedLabel(thread.lastActivity)}
                  </span>
                  <Link
                    className="inline-flex min-h-11 items-center text-primary"
                    href={`/explore/clusters/${thread.id}`}
                  >
                    Explore thread →
                  </Link>
                </div>
              </div>
            </foreignObject>
          );
        })}
      </g>
    </svg>
  );
}
