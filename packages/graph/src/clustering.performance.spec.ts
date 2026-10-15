import { performance } from "node:perf_hooks";
import { expect, test } from "vitest";
import {
  buildClusters,
  type ClusterNote,
  type ClusterReference,
} from "./clustering.js";

test("10,000 notes and 100,000 occurrences stay bounded, including a high-degree source", () => {
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
  const started = performance.now();
  const result = buildClusters(notes, refs);
  const milliseconds = performance.now() - started;
  expect(result).toHaveLength(500);
  expect(result.every((c) => c.primaryDocumentIds.length === 20)).toBe(true);
  expect(result.every((c) => c.sources[0]?.documentCount === 20)).toBe(true);
  expect(milliseconds).toBeLessThan(30_000);
  console.info(
    JSON.stringify({
      milliseconds: Math.round(milliseconds),
      notes: notes.length,
      peakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024),
      references: refs.length,
    }),
  );
}, 30_000);
