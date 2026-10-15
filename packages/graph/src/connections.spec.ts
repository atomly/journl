import { expect, test } from "vitest";
import { getConnectedNotes, getNoteClusters } from "./connections.ts";

test("bounded payloads ignore missing nodes and self edges, deduplicate occurrences, and keep sources", () => {
  const nodes = ["a", "b", "c", "unlinked", "source"].map((key) => ({
    key,
    kind: key === "source" ? "external" : "page",
    title: key,
  }));
  const graph = {
    edges: [
      { fromKey: "a", toKey: "b" },
      { fromKey: "a", toKey: "b" },
      { fromKey: "c", toKey: "source" },
      { fromKey: "a", toKey: "missing" },
      { fromKey: "unlinked", toKey: "unlinked" },
    ],
    nodes,
  };
  expect(getConnectedNotes(graph, "a").map((n) => n.key)).toEqual(["b"]);
  expect(getConnectedNotes(graph, "missing")).toEqual([]);
  expect(
    getNoteClusters(graph).clusters.map((c) => c.map((n) => n.key)),
  ).toEqual([
    ["a", "b"],
    ["c", "source"],
  ]);
  expect(getNoteClusters(graph).unlinked.map((n) => n.key)).toEqual([
    "unlinked",
  ]);
});
