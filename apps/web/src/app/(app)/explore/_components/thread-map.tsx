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
export function ThreadCard({ thread }: { thread: Thread }) {
  return (
    <Link
      href={`/explore/clusters/${thread.id}`}
      className="group flex h-full min-w-0 flex-col gap-3 rounded-2xl border border-border/70 bg-card/80 p-4 transition-colors hover:border-primary/60 hover:bg-accent/20 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div>
        <h2 className="line-clamp-2 font-medium text-base">{thread.name}</h2>
        <p className="mt-1 text-muted-foreground text-xs">
          {thread.primaryCount} notes · {thread.sourceCount} sources
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
        <span className="text-primary">Explore thread →</span>
      </p>
    </Link>
  );
}
export function ThreadMap({
  threads,
  width,
  camera,
  onCamera,
}: {
  threads: Thread[];
  width: number;
  camera: ExploreCamera;
  onCamera(camera: ExploreCamera): void;
}) {
  const columns = width >= 650 ? 2 : 1;
  const rowHeight = 244;
  const height = Math.max(
    360,
    Math.ceil(threads.length / columns) * rowHeight + 32,
  );
  const gestures = useExploreCamera(camera, onCamera, width, height);
  const cellWidth = (width - 48) / columns;
  // Islands represent membership, not invented note-to-note edges.
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block w-full touch-none select-none"
      aria-label="Threads in your notes. Open a thread to explore its notes and sources."
      {...gestures}
    >
      <g
        transform={`translate(${width / 2 + camera.x} ${height / 2 + camera.y}) scale(${camera.zoom}) translate(${-width / 2} ${-height / 2})`}
      >
        {[...threads]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((thread, i) => (
            <foreignObject
              key={thread.id}
              x={24 + (i % columns) * cellWidth}
              y={24 + Math.floor(i / columns) * rowHeight}
              width={cellWidth - 16}
              height={rowHeight - 24}
            >
              <ThreadCard thread={thread} />
            </foreignObject>
          ))}
      </g>
    </svg>
  );
}
