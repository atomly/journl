import { schema } from "@acme/blocknote/schema";
import { blocknoteBlocks, serverSchema } from "@acme/blocknote/server";
import { ServerBlockNoteEditor } from "@blocknote/server-util";
import { expect, test } from "vitest";
import acceptedSchema from "./accepted-schema.json";
import { historicalFixtures, inventoryId, parityBlocks } from "./fixtures";

const editor = ServerBlockNoteEditor.create({ schema: serverSchema });
function walk(
  value: unknown,
  visit: (record: Record<string, unknown>) => void,
) {
  if (Array.isArray(value)) {
    for (const child of value) walk(child, visit);
  } else if (value && typeof value === "object") {
    visit(value as Record<string, unknown>);
    for (const child of Object.values(value)) walk(child, visit);
  }
}
function ids(value: unknown) {
  const result: string[] = [];
  walk(value, (record) => {
    if (typeof record.id === "string") result.push(record.id);
  });
  return result;
}

test("accepted blocks, inline nodes, styles and property defaults cannot drift without a parity review", () => {
  for (const current of [schema, serverSchema]) {
    expect(
      JSON.parse(
        JSON.stringify({
          blockSchema: current.blockSchema,
          inlineContentSchema: current.inlineContentSchema,
          styleSchema: current.styleSchema,
        }),
      ),
    ).toEqual(acceptedSchema);
  }
});

test("synthetic examples cover every accepted block, inline node and text style", () => {
  const blockTypes = new Set<string>();
  const inlineTypes = new Set<string>();
  const styles = new Set<string>();
  walk(parityBlocks, (record) => {
    if (typeof record.type === "string") {
      if (record.type in schema.blockSchema) blockTypes.add(record.type);
      if (record.type in schema.inlineContentSchema)
        inlineTypes.add(record.type);
    }
    if (record.styles && typeof record.styles === "object")
      for (const key of Object.keys(record.styles)) styles.add(key);
  });
  expect([...blockTypes].sort()).toEqual(
    Object.keys(schema.blockSchema).sort(),
  );
  expect([...inlineTypes].sort()).toEqual(
    Object.keys(schema.inlineContentSchema).sort(),
  );
  expect([...styles].sort()).toEqual(Object.keys(schema.styleSchema).sort());
  expect(new Set(ids(parityBlocks)).size).toBe(ids(parityBlocks).length);
});

test("the installed editor accepts the fixture and retains identities, nesting, table spans and reference targets", () => {
  const node = editor._blocksToProsemirrorNode(parityBlocks);
  const normalized = editor._prosemirrorJSONToBlocks(node.toJSON());
  expect(ids(normalized)).toEqual(ids(parityBlocks));
  expect(normalized[0]).toMatchObject(parityBlocks[0]);
  expect(
    editor._prosemirrorJSONToBlocks(
      editor._blocksToProsemirrorNode(normalized).toJSON(),
    ),
  ).toEqual(normalized);
  const encoded = JSON.stringify(normalized);
  for (const value of [
    "Styled writing 世界",
    "Checked grandchild",
    "Legacy array cell",
    "Merged heading",
    "Synthetic file caption",
    '"colspan":2',
    '"start":7',
    '"level":6',
    '"isToggleable":true',
    inventoryId(21),
    "Unavailable target",
  ])
    expect(encoded).toContain(value);
});

test("current export is explicitly lossy: references retain readable URLs and labels, not live presentation", async () => {
  const markdown = await editor.blocksToMarkdownLossy(parityBlocks);
  expect(markdown).toContain("Synthetic referenced note");
  expect(markdown).toContain("example.invalid/reference");
  expect(markdown).toContain("Numbered child");
  expect(markdown).not.toContain('"type":"contentEmbed"');
});

test.each(
  historicalFixtures.filter((fixture) => fixture.disposition === "load"),
)("loads the documented historical shape: $name", (fixture) => {
  const original = JSON.stringify(fixture);
  const blocks = blocknoteBlocks([...fixture.nodes], [...fixture.edges]);
  expect(blocks).toBeDefined();
  const normalized = editor._prosemirrorJSONToBlocks(
    editor._blocksToProsemirrorNode(blocks ?? []).toJSON(),
  );
  expect(ids(normalized).sort()).toEqual(
    fixture.nodes.map((node) => node.id).sort(),
  );
  expect(JSON.stringify(fixture)).toBe(original);
  if (fixture.name === "sibling-order-and-nesting") {
    expect(normalized.map((block) => block.id)).toEqual([
      inventoryId(111),
      inventoryId(113),
    ]);
    expect(normalized[0]?.children[0]?.id).toBe(inventoryId(112));
  }
});

test("unknown blocks and unreachable children remain raw recovery specimens, not silently certified conversions", () => {
  const unknown = historicalFixtures.find(
    (fixture) => fixture.name === "unknown-block",
  );
  const unreachable = historicalFixtures.find(
    (fixture) => fixture.name === "missing-parent",
  );
  if (!unknown || !unreachable) throw new Error("Missing historical specimens");
  const blocks = blocknoteBlocks([...unknown.nodes], []);
  expect(() => editor._blocksToProsemirrorNode(blocks ?? [])).toThrow();
  // Current reconstruction cannot expose a child whose parent is outside this document.
  // Preserve this input for the future migration/quarantine decision; do not bless its loss.
  expect(blocknoteBlocks([...unreachable.nodes], [])).toBeUndefined();
  expect(JSON.stringify(unreachable.nodes)).toContain(
    "Unreachable child must remain recoverable",
  );
});

test.each(["missing-props", "empty-object-default"])(
  "records the current reconstruction rejection for %s without normalizing away raw data",
  (name) => {
    const fixture = historicalFixtures.find((entry) => entry.name === name);
    if (!fixture) throw new Error("Missing raw fixture");
    const raw = JSON.stringify(fixture.nodes);
    expect(() => blocknoteBlocks([...fixture.nodes], [])).toThrow();
    expect(JSON.stringify(fixture.nodes)).toBe(raw);
  },
);
