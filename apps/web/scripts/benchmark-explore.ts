import { performance } from "node:perf_hooks";
import {
  buildClusters,
  type ClusterNote,
  type ClusterReference,
} from "../src/explore/clustering";

const notes: ClusterNote[] = Array.from({ length: 10000 }, (_, i) => ({
  href: `/pages/${i}`,
  id: `note-${String(i).padStart(5, "0")}`,
  kind: "page",
  title: `Project ${Math.floor(i / 20)}`,
  updatedAt: "2026-10-08T00:00:00Z",
}));
const refs: ClusterReference[] = notes.map((n) => ({
  id: `${n.id}-source`,
  source: n.id,
  sourceKey: "popular",
  url: "https://example.com/docs",
}));
for (let start = 0; start < notes.length; start += 20) {
  let count = 0;
  for (let i = start; i < start + 20; i++)
    for (let j = i + 1; j < start + 20; j++)
      if (count++ < 180)
        refs.push({
          id: `${i}-${j}`,
          source: notes[i]!.id,
          target: notes[j]!.id,
        });
}
const before = process.memoryUsage().rss;
const start = performance.now();
const clusters = buildClusters(notes, refs);
const elapsed = performance.now() - start;
if (
  clusters.length !== 500 ||
  clusters.some((c) => c.primaryDocumentIds.length !== 20)
)
  throw new Error(`Unexpected membership: ${clusters.length}`);
console.log(
  JSON.stringify({
    clusters: clusters.length,
    milliseconds: Math.round(elapsed),
    notes: notes.length,
    references: refs.length,
    rssGrowthMB: Math.round((process.memoryUsage().rss - before) / 1024 / 1024),
    rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
  }),
);
if (elapsed > 30000)
  throw new Error("Clustering exceeded the 30 second fixture budget");
