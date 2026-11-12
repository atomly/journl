// @vitest-environment jsdom
import type { AnyExtension } from "@tiptap/core";
import { expect, test, vi } from "vitest";
import {
  AdapterReadError,
  fromTiptapDocument,
  toTiptapDocument,
} from "../serialization/tiptap";
import { tablePresentationExtensions } from "../ui/table-presentation";
import { createDocumentEditor } from "./editor";
import { referenceExtensions } from "./reference-schema";
import { tableExtensions } from "./table-schema";

const table = {
  content: { rows: [{ cells: ["One", "Two"] }], type: "tableContent" as const },
  id: "table",
  type: "table" as const,
};
const reference = {
  id: "reference",
  props: {
    blockId: "",
    documentId: "source",
    label: "Source",
    resolutionToken: "",
    targetKind: "document" as const,
    url: "https://example.com",
    version: 1 as const,
  },
  type: "referenceCard" as const,
};
const create = (
  extensions: AnyExtension[],
  initialBlocks = [{ id: "a", type: "paragraph" as const }],
) =>
  createDocumentEditor({
    element: document.createElement("div"),
    extensions,
    initialBlocks,
    resolveUrl: async () => ({ items: [] }),
  });

test("plain editors do not install table or reference schemas", () => {
  const editor = create([]);
  try {
    expect(editor.schema.nodes.paragraph).toBeDefined();
    for (const name of [
      "table",
      "tableRow",
      "tableCell",
      "contentReference",
      "referenceCard",
      "contentEmbed",
    ])
      expect(editor.schema.nodes[name]).toBeUndefined();
  } finally {
    editor.destroy();
  }
});

test("table and reference features can be installed independently", () => {
  const tables = createDocumentEditor({
    element: document.createElement("div"),
    extensions: tableExtensions(),
    initialBlocks: [table],
    resolveUrl: async () => ({ items: [] }),
  });
  const references = createDocumentEditor({
    element: document.createElement("div"),
    extensions: referenceExtensions(),
    initialBlocks: [reference],
    resolveUrl: async () => ({ items: [] }),
  });
  try {
    expect(tables.schema.nodes.contentReference).toBeUndefined();
    expect(references.schema.nodes.table).toBeUndefined();
    expect(fromTiptapDocument(tables.state.doc)).toEqual(
      fromTiptapDocument(toTiptapDocument([table])),
    );
    expect(fromTiptapDocument(references.state.doc)[0]).toMatchObject(
      reference,
    );
  } finally {
    tables.destroy();
    references.destroy();
  }
});

test("omitting a feature fails with preserved content instead of silently removing its nodes", () => {
  for (const block of [table, reference]) {
    let failure: unknown;
    try {
      createDocumentEditor({
        element: document.createElement("div"),
        extensions: [],
        initialBlocks: [block],
        resolveUrl: async () => ({ items: [] }),
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(AdapterReadError);
    expect((failure as AdapterReadError).original).toEqual([block]);
  }
});

test("consumer presentation replaces an optional feature schema exactly once", () => {
  const editor = createDocumentEditor({
    element: document.createElement("div"),
    extensions: [...tableExtensions(), ...tablePresentationExtensions()],
    initialBlocks: [table],
    resolveUrl: async () => ({ items: [] }),
  });
  try {
    expect(
      editor.extensionManager.extensions.filter(
        (extension) => extension.name === "table",
      ),
    ).toHaveLength(1);
    expect(
      editor.view.dom.querySelectorAll(".better-editor-table-wrapper"),
    ).toHaveLength(1);
    expect(fromTiptapDocument(editor.state.doc)).toEqual(
      fromTiptapDocument(toTiptapDocument([table])),
    );
  } finally {
    editor.destroy();
  }
});

test("editability notifications do not normalize unchanged content into a save", () => {
  const onCommit = vi.fn();
  const editor = createDocumentEditor({
    element: document.createElement("div"),
    extensions: [],
    initialBlocks: [{ content: "Existing", id: "a", type: "paragraph" }],
    onCommit,
    resolveUrl: async () => ({ items: [] }),
  });
  try {
    editor.setEditable(false);
    editor.setEditable(true);
    expect(onCommit).not.toHaveBeenCalled();
    editor.commands.insertContent("New ");
    expect(onCommit).toHaveBeenCalledTimes(1);
  } finally {
    editor.destroy();
  }
});
