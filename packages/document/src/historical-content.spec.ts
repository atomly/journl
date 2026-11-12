import { expect, test } from "vitest";
import accepted from "./accepted-content.json";
import {
  historicalFixtures,
  inventoryDocumentId,
  parityBlocks,
} from "./fixtures";
import {
  DocumentReadError,
  documentBlocks,
  documentMarkdown,
  documentRows,
} from "./index";

function visit(value: unknown, fn: (record: Record<string, unknown>) => void) {
  if (Array.isArray(value)) for (const item of value) visit(item, fn);
  else if (value && typeof value === "object") {
    fn(value as Record<string, unknown>);
    for (const child of Object.values(value)) visit(child, fn);
  }
}

test("historical fixtures cover every accepted block, inline node, and style", () => {
  const blocks = new Set<string>();
  const inline = new Set<string>();
  const styles = new Set<string>();
  visit(parityBlocks, (node) => {
    if (typeof node.type === "string") {
      if (node.type in accepted.blockSchema) blocks.add(node.type);
      if (node.type in accepted.inlineContentSchema) inline.add(node.type);
    }
    if (node.styles && typeof node.styles === "object")
      for (const name of Object.keys(node.styles)) styles.add(name);
  });
  expect([...blocks].sort()).toEqual(Object.keys(accepted.blockSchema).sort());
  expect([...inline].sort()).toEqual(
    Object.keys(accepted.inlineContentSchema).sort(),
  );
  expect([...styles].sort()).toEqual(Object.keys(accepted.styleSchema).sort());
});

test("the full content inventory survives JSON storage with identities and references intact", () => {
  const rows = documentRows(parityBlocks);
  const encoded = JSON.parse(JSON.stringify(rows)) as typeof rows;
  const scope = { document_id: inventoryDocumentId, user_id: "fixture" };
  const rebuilt = documentBlocks(
    encoded.blocks.map((block) => ({ ...scope, ...block })),
    encoded.edges.map((edge) => ({ ...scope, ...edge })),
  );
  expect(JSON.parse(JSON.stringify(documentRows(rebuilt ?? [])))).toEqual(
    encoded,
  );
  const markdown = documentMarkdown(rebuilt ?? []);
  for (const value of [
    "Synthetic referenced note",
    "example.invalid/reference",
    "Numbered child",
    "Legacy array cell",
    "Merged heading",
    "Synthetic file caption",
  ])
    expect(markdown).toContain(value);
});

test.each(
  historicalFixtures.filter((fixture) => fixture.disposition === "load"),
)("historical $name retains identities and source rows", (fixture) => {
  const original = structuredClone(fixture);
  const blocks = documentBlocks(fixture.nodes, fixture.edges);
  expect(
    documentRows(blocks ?? [])
      .blocks.map((block) => block.id)
      .sort(),
  ).toEqual(fixture.nodes.map((node) => node.id).sort());
  expect(fixture).toEqual(original);
});

test.each(
  historicalFixtures.filter(
    (fixture) => fixture.disposition === "preserve-raw",
  ),
)("historical $name retains complete raw recovery data", (fixture) => {
  try {
    documentBlocks(fixture.nodes, fixture.edges);
    throw new Error("Expected recovery");
  } catch (error) {
    expect(error).toBeInstanceOf(DocumentReadError);
    expect((error as DocumentReadError).original).toEqual({
      blocks: fixture.nodes,
      edges: fixture.edges,
    });
  }
});
