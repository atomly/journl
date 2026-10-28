import {
  copySlice,
  identityPlugin,
  joinBlocks,
  splitBlock,
} from "../engine/identity";
import { documentSchema } from "./tiptap";
// @vitest-environment jsdom

import {
  applyDocumentOperations,
  documentBlocks,
  documentRows,
  parseBlock,
} from "@acme/document";
import { historicalFixtures, parityBlocks } from "@acme/document/fixtures";
import { Editor } from "@tiptap/core";
import { closeHistory, history, redo, undo } from "@tiptap/pm/history";
import { DOMParser, DOMSerializer, Slice } from "@tiptap/pm/model";
import {
  EditorState,
  NodeSelection,
  TextSelection,
  type Transaction,
} from "@tiptap/pm/state";
import { describe, expect, test } from "vitest";
import { documentChanges } from "../engine/changes";
import { blockAt } from "../engine/identity";
import { referenceSelectionPlugin } from "../engine/reference-selection";
import { required } from "../engine/required";
import { documentExtensions } from "../engine/schema";
import {
  AdapterReadError,
  fromTiptapDocument,
  toTiptapDocument,
} from "./tiptap";

const schema = documentSchema();
const paragraph = (id: string, content = id) =>
  parseBlock({ content, id, type: "paragraph" });
function factory() {
  let value = 0;
  return () => `new-${++value}`;
}
function session(blocks = [paragraph("a", "abcdef"), paragraph("b")]) {
  let state = EditorState.create({
    doc: toTiptapDocument(blocks, schema),
    plugins: [history(), identityPlugin(factory())],
  });
  return {
    get blocks() {
      return fromTiptapDocument(state.doc);
    },
    dispatch(tr: Transaction) {
      state = state.applyTransaction(tr).state;
    },
    get state() {
      return state;
    },
  };
}

test("the complete inventory survives the real Tiptap schema and JSON storage boundary", () => {
  const original = toTiptapDocument(parityBlocks, schema);
  const domain = fromTiptapDocument(original);
  const encoded = JSON.parse(JSON.stringify(documentRows(domain)));
  const scope = { document_id: "inventory", user_id: "inventory" };
  const rebuilt = documentBlocks(
    encoded.blocks.map((row: object) => ({ ...scope, ...row })),
    encoded.edges.map((row: object) => ({ ...scope, ...row })),
  );
  expect(toTiptapDocument(rebuilt ?? [], schema).eq(original)).toBe(true);
  expect(documentRows(domain).blocks.map((block) => block.id)).toEqual(
    documentRows(parityBlocks).blocks.map((block) => block.id),
  );
  const editor = new Editor({
    content: original.toJSON(),
    element: document.createElement("div"),
    enableContentCheck: true,
    extensions: documentExtensions(),
  });
  expect(editor.state.doc.toJSON()).toEqual(original.toJSON());
  expect(fromTiptapDocument(editor.state.doc)).toEqual(domain);
  editor.destroy();
});

test.each(
  historicalFixtures.filter((fixture) => fixture.disposition === "load"),
)("loads historical $name without changing identity/order", (fixture) => {
  const blocks = documentBlocks(fixture.nodes, fixture.edges) ?? [];
  const doc = toTiptapDocument(blocks, schema);
  expect(toTiptapDocument(fromTiptapDocument(doc), schema).eq(doc)).toBe(true);
  expect(documentRows(fromTiptapDocument(doc)).edges).toEqual(
    documentRows(blocks).edges,
  );
});

test("unknown content fails before schema normalization and preserves independent input", () => {
  const input = [
    {
      content: "Keep me",
      id: "future",
      type: "future",
      unknown: { authored: true },
    },
  ];
  try {
    toTiptapDocument(input as never, schema);
    throw new Error("Expected rejection");
  } catch (error) {
    expect(error).toBeInstanceOf(AdapterReadError);
    expect((error as AdapterReadError).original).toEqual(input);
    required(input[0]).unknown.authored = false;
    expect((error as AdapterReadError).original).not.toEqual(input);
  }
  expect(() =>
    toTiptapDocument(
      [{ ...paragraph("a"), props: { future: "writing" } }] as never,
      schema,
    ),
  ).toThrow(AdapterReadError);
});

test("plain code has no marks, styles coexist, references retain complete targets, and table metadata survives", () => {
  const blocks = fromTiptapDocument(toTiptapDocument(parityBlocks, schema));
  const first = required(blocks[0]);
  expect(first.content).toEqual(required(parityBlocks[0]).content);
  for (const block of parityBlocks.filter((block) =>
    [
      "table",
      "referenceCard",
      "contentEmbed",
      "image",
      "video",
      "audio",
      "file",
      "codeBlock",
    ].includes(block.type),
  )) {
    const roundTrip = required(blocks.find((value) => value.id === block.id));
    expect(roundTrip.props).toEqual(block.props);
    expect(
      toTiptapDocument([roundTrip], schema).eq(
        toTiptapDocument([block], schema),
      ),
    ).toBe(true);
  }
});

test("split/join preserve surviving identities and children; undo/redo restore exact identities", () => {
  const input = [
    parseBlock({ ...paragraph("a", "abcdef"), children: [paragraph("child")] }),
    paragraph("b"),
  ];
  const editor = session(input);
  const original = editor.state.doc;
  editor.dispatch(splitBlock(editor.state.tr, "a", 3, factory()));
  expect(editor.blocks.map((block) => block.id)).toEqual(["a", "new-1", "b"]);
  expect(required(editor.blocks[0]).children?.[0]?.id).toBe("child");
  expect(required(editor.blocks[1]).children).toBeUndefined();
  const split = editor.state.doc;
  expect(undo(editor.state, editor.dispatch)).toBe(true);
  expect(editor.state.doc.eq(original)).toBe(true);
  expect(redo(editor.state, editor.dispatch)).toBe(true);
  expect(editor.state.doc.eq(split)).toBe(true);
  editor.dispatch(joinBlocks(closeHistory(editor.state.tr), "a", "new-1"));
  expect(editor.blocks.map((block) => block.id)).toEqual(["a", "b"]);
  expect(editor.state.doc.eq(original)).toBe(true);
  expect(undo(editor.state, editor.dispatch)).toBe(true);
  expect(editor.state.doc.eq(split)).toBe(true);
});

test("raw ProseMirror split repairs duplicate IDs in the same undo group", () => {
  const editor = session();
  const original = editor.state.doc;
  editor.dispatch(editor.state.tr.split(5, 2));
  expect(editor.blocks.map((block) => block.id)).toEqual(["a", "new-1", "b"]);
  expect(undo(editor.state, editor.dispatch)).toBe(true);
  expect(editor.state.doc.eq(original)).toBe(true);
});

test("copy/duplicate refresh nested IDs and preserve authored links to source blocks", () => {
  const doc = toTiptapDocument(parityBlocks, schema);
  const copied = copySlice(new Slice(doc.content, 0, 0), factory());
  const result = fromTiptapDocument(
    schema.topNodeType.createChecked(null, copied.content),
  );
  const sourceIds = new Set(
    documentRows(parityBlocks).blocks.map((block) => block.id),
  );
  for (const block of documentRows(result).blocks)
    expect(sourceIds.has(block.id)).toBe(false);
  expect(required(result[0]).content).toEqual(
    required(parityBlocks[0]).content,
  );
});

test("copy inserted before the source retains the mapped source ID", () => {
  const editor = session();
  const source = blockAt(editor.state.doc, "a").node;
  editor.dispatch(editor.state.tr.insert(0, source));
  expect(editor.blocks.map((block) => block.id)).toEqual(["new-1", "a", "b"]);
});

test("a genuine move retains IDs through undo and redo", () => {
  const editor = session();
  const a = blockAt(editor.state.doc, "a");
  const transaction = editor.state.tr.delete(a.pos, a.pos + a.node.nodeSize);
  transaction.insert(transaction.doc.content.size, a.node);
  editor.dispatch(transaction);
  expect(editor.blocks.map((block) => block.id)).toEqual(["b", "a"]);
  expect(undo(editor.state, editor.dispatch)).toBe(true);
  expect(editor.blocks.map((block) => block.id)).toEqual(["a", "b"]);
  expect(redo(editor.state, editor.dispatch)).toBe(true);
  expect(editor.blocks.map((block) => block.id)).toEqual(["b", "a"]);
});

test("empty documents and invalid identity factories cannot silently create duplicate storage IDs", () => {
  expect(fromTiptapDocument(toTiptapDocument([], schema))).toEqual([]);
  expect(() =>
    toTiptapDocument([paragraph("a"), paragraph("a")], schema),
  ).toThrow(AdapterReadError);
  expect(() => splitBlock(session().state.tr, "a", 1, () => "a")).toThrow(
    "fresh",
  );
});

describe("committed changes become framework-independent domain operations", () => {
  test.each([
    [
      [paragraph("a"), paragraph("b")],
      [paragraph("b"), paragraph("a", "Changed")],
    ],
    [
      [parseBlock({ ...paragraph("parent"), children: [paragraph("child")] })],
      [paragraph("child")],
    ],
    [
      [parseBlock({ ...paragraph("a"), children: [paragraph("b")] })],
      [parseBlock({ ...paragraph("b"), children: [paragraph("a")] })],
    ],
    [[], parityBlocks],
    [parityBlocks, []],
  ])(
    "applies structural change %# through the existing contract",
    (before, after) => {
      const doc = toTiptapDocument(after, schema);
      const operations = documentChanges(before, doc);
      const result = applyDocumentOperations(before, operations);
      expect(toTiptapDocument(result, schema).eq(doc)).toBe(true);
      expect(JSON.stringify(operations)).not.toContain("betterEditorBlock");
      expect(documentChanges(fromTiptapDocument(doc), doc)).toEqual([]);
    },
  );
});

test("reference selection plugin works with the owned schema and native atom selections", () => {
  const doc = toTiptapDocument([required(parityBlocks[0])], schema);
  let referencePos = 0;
  doc.descendants((node, pos) => {
    if (node.type.name === "contentReference") referencePos = pos;
  });
  const state = EditorState.create({
    doc,
    plugins: [referenceSelectionPlugin()],
  });
  const next = state.applyTransaction(
    state.tr.setSelection(
      TextSelection.create(doc, referencePos, referencePos + 1),
    ),
  ).state;
  expect(next.selection).toBeInstanceOf(NodeSelection);
  expect(next.selection.from).toBe(referencePos);
});

test("native clipboard HTML retains reference targets, table metadata, styles and nesting", () => {
  const doc = toTiptapDocument(parityBlocks, schema);
  const element = document.createElement("div");
  element.append(
    DOMSerializer.fromSchema(schema).serializeFragment(doc.content),
  );
  const parsed = DOMParser.fromSchema(schema).parse(element, {
    preserveWhitespace: "full",
  });
  expect(parsed.toJSON()).toEqual(doc.toJSON());
});

test("native editor paste refreshes nested identities and keeps reference targets", () => {
  const source = toTiptapDocument(parityBlocks, schema);
  const html = document.createElement("div");
  html.append(
    DOMSerializer.fromSchema(schema).serializeFragment(source.content),
  );
  const plugin = identityPlugin(factory());
  const editor = new Editor({
    content: toTiptapDocument([paragraph("destination")], schema).toJSON(),
    element: document.createElement("div"),
    extensions: documentExtensions(),
  });
  editor.registerPlugin(plugin);
  editor.view.dispatch(
    editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 0)),
  );
  expect(
    editor.view.pasteHTML(html.innerHTML, new Event("paste") as ClipboardEvent),
  ).toBe(true);
  const pasted = fromTiptapDocument(editor.state.doc);
  expect(documentRows(pasted).blocks).toHaveLength(
    documentRows(parityBlocks).blocks.length,
  );
  const sourceIds = new Set(
    documentRows(parityBlocks).blocks.map((block) => block.id),
  );
  for (const block of documentRows(pasted).blocks)
    expect(sourceIds.has(block.id)).toBe(false);
  expect(required(pasted[0]).content).toEqual(
    required(parityBlocks[0]).content,
  );
  editor.destroy();
});
