import { schema } from "@acme/blocknote/schema";
import { DocumentReadError, documentBlocks } from "@acme/document";
import {
  historicalFixtures,
  inventoryId,
  parityBlocks,
} from "@acme/document/fixtures";
import { ServerBlockNoteEditor } from "@blocknote/server-util";
import { expect, test } from "vitest";
import { toBlockNoteBlocks } from "../document-adapter";
import acceptedSchema from "./accepted-schema.json";
import { inventorySchema } from "./server-schema";

const editor = ServerBlockNoteEditor.create({ schema: inventorySchema });
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
  for (const current of [schema, inventorySchema]) {
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
  const node = editor._blocksToProsemirrorNode(
    toBlockNoteBlocks(parityBlocks) ?? [],
  );
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
  const markdown = await editor.blocksToMarkdownLossy(
    toBlockNoteBlocks(parityBlocks) ?? [],
  );
  expect(markdown).toContain("Synthetic referenced note");
  expect(markdown).toContain("example.invalid/reference");
  expect(markdown).toContain("Numbered child");
  expect(markdown).not.toContain('"type":"contentEmbed"');
});

test.each(
  historicalFixtures.filter((fixture) => fixture.disposition === "load"),
)("loads the documented historical shape: $name", (fixture) => {
  const original = JSON.stringify(fixture);
  const blocks = documentBlocks([...fixture.nodes], [...fixture.edges]);
  expect(blocks).toBeDefined();
  const normalized = editor._prosemirrorJSONToBlocks(
    editor._blocksToProsemirrorNode(toBlockNoteBlocks(blocks) ?? []).toJSON(),
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

test.each(
  historicalFixtures.filter(
    (fixture) => fixture.disposition === "preserve-raw",
  ),
)(
  "reports $name with original recovery data instead of partial reconstruction",
  (fixture) => {
    expect(() => documentBlocks(fixture.nodes, fixture.edges)).toThrow(
      DocumentReadError,
    );
  },
);

test("explicit legacy reader now accepts omitted props without mutating the original payload", () => {
  const fixture = historicalFixtures.find(
    (entry) => entry.name === "missing-props",
  );
  if (!fixture) throw new Error("Missing historical fixture");
  const original = JSON.stringify(fixture.nodes);
  const blocks = documentBlocks(fixture.nodes, fixture.edges);
  expect(blocks?.[0]).toMatchObject({
    content: "Props were omitted",
    type: "paragraph",
  });
  expect(
    editor._blocksToProsemirrorNode(toBlockNoteBlocks(blocks) ?? []),
  ).toBeDefined();
  expect(JSON.stringify(fixture.nodes)).toBe(original);
});
