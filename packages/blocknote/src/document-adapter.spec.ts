import {
  DocumentReadError,
  documentBlocks,
  documentMarkdown,
  documentRows,
} from "@acme/document";
import { ServerBlockNoteEditor } from "@blocknote/server-util";
import { expect, test } from "vitest";
import { fromBlockNoteBlocks, toBlockNoteBlocks } from "./document-adapter";
import {
  historicalFixtures,
  inventoryDocumentId,
  parityBlocks,
} from "./inventory/fixtures";
import { serverSchema } from "./server/blocknote-schema";

const editor = ServerBlockNoteEditor.create({ schema: serverSchema });
const normalize = (
  blocks: Parameters<typeof editor._blocksToProsemirrorNode>[0],
) =>
  editor._prosemirrorJSONToBlocks(
    editor._blocksToProsemirrorNode(blocks).toJSON(),
  );

test("all installed content survives the actual editor -> Journl -> storage -> Journl -> editor boundary", () => {
  const original = normalize(toBlockNoteBlocks(parityBlocks) ?? []);
  const domain = fromBlockNoteBlocks(original);
  const rows = documentRows(domain);
  // Database JSONB/network serialization turns undefined table widths into null.
  const persisted = JSON.parse(JSON.stringify(rows));
  const scope = { document_id: inventoryDocumentId, user_id: "fixture" };
  const rebuilt = documentBlocks(
    persisted.blocks.map((block: (typeof rows.blocks)[number]) => ({
      ...scope,
      ...block,
    })),
    persisted.edges.map((edge: (typeof rows.edges)[number]) => ({
      ...scope,
      ...edge,
    })),
  );
  expect(normalize(toBlockNoteBlocks(rebuilt) ?? [])).toEqual(original);
  const markdown = documentMarkdown(domain);
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
)(
  "Journl reads supported historical fixture $name without the editor",
  (fixture) => {
    const blocks = documentBlocks(fixture.nodes, fixture.edges);
    expect(normalize(toBlockNoteBlocks(blocks) ?? [])).toHaveLength(
      blocks?.length ?? 0,
    );
    expect(
      documentRows(blocks ?? [])
        .blocks.map((block) => block.id)
        .sort(),
    ).toEqual(fixture.nodes.map((node) => node.id).sort());
  },
);

test.each(
  historicalFixtures.filter((fixture) =>
    [
      "unknown-block",
      "malformed-content",
      "missing-parent",
      "sibling-cycle",
      "empty-object-default",
    ].includes(fixture.name),
  ),
)(
  "Journl preserves the complete original $name for explicit recovery",
  (fixture) => {
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
  },
);
