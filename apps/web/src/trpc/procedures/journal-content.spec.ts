import { historicalFixtures } from "@acme/blocknote/inventory";
import { expect, test } from "vitest";
import { readJournalContent } from "./journal-content";

test.each(historicalFixtures)(
  "journal list isolates $name without altering its original rows",
  (fixture) => {
    const input = {
      block_edges: fixture.edges,
      block_nodes: fixture.nodes,
      date: "2026-10-01",
      document_id: "saved-document",
    };
    const original = structuredClone(input);
    const result = readJournalContent(input);
    expect("contentReadError" in result && result.contentReadError).toBe(
      fixture.disposition !== "load",
    );
    if (fixture.disposition === "load") expect(result).toHaveProperty("blocks");
    else expect(result).not.toHaveProperty("blocks");
    expect(result).not.toHaveProperty("block_nodes");
    expect(result).not.toHaveProperty("block_edges");
    expect(input).toEqual(original);
  },
);

test("a genuinely empty document remains editable, distinct from a failed read", () => {
  expect(readJournalContent({ block_edges: [], block_nodes: [] })).toEqual({
    blocks: undefined,
  });
});

test("ambiguous legacy ordering remains protected without exposing a partial editor document", () => {
  const base = historicalFixtures[0]?.nodes[0];
  if (!base) throw new Error("Missing fixture");
  expect(
    readJournalContent({
      block_edges: [],
      block_nodes: [base, { ...base, id: "another-block" }],
    }),
  ).toEqual({ contentReadError: true });
});
