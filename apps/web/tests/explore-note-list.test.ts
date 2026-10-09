import { expect, test } from "vitest";
import type { ExploreNode } from "../src/references/explore-graph";
import {
  exploreUpdatedLabel,
  sortExploreNotes,
} from "../src/references/explore-note-list";

test("note discovery follows edit dates instead of alphabetical journal titles", () => {
  const notes: ExploreNode[] = [
    {
      key: "older",
      kind: "journal",
      title: "Apr 5, 2026",
      updatedAt: "2026-04-05T12:00:00Z",
    },
    {
      key: "latest",
      kind: "journal",
      title: "Aug 2, 2025",
      updatedAt: "2026-10-07T12:00:00Z",
    },
    { key: "missing", kind: "page", title: "A missing date" },
  ];
  expect(sortExploreNotes(notes, "latest").map((note) => note.key)).toEqual([
    "latest",
    "older",
    "missing",
  ]);
  expect(sortExploreNotes(notes, "oldest").map((note) => note.key)).toEqual([
    "older",
    "latest",
    "missing",
  ]);
  expect(notes[0]?.key).toBe("older");
  expect(exploreUpdatedLabel("invalid")).toBeUndefined();
  expect(exploreUpdatedLabel(undefined)).toBeUndefined();
});
