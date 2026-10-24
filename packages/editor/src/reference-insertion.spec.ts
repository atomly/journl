// @vitest-environment jsdom

import type { ReferenceClient } from "@acme/references";
import {
  documentExtensions,
  editingExtension,
  fromTiptapDocument,
  identityExtension,
  toTiptapDocument,
} from "@acme/tiptap";
import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { expect, test, vi } from "vitest";
import { insertTiptapReference } from "./reference-insertion";

const url = "https://example.invalid/source";
type Result = Awaited<ReturnType<ReferenceClient["resolveUrl"]>>;
function setup(text = "") {
  return new Editor({
    content: toTiptapDocument([
      { content: text, id: "source", type: "paragraph" },
    ]).toJSON(),
    element: document.createElement("div"),
    extensions: [
      ...documentExtensions(),
      editingExtension(() => crypto.randomUUID()),
      identityExtension(() => crypto.randomUUID()),
    ],
  });
}

test("a pending URL follows its token while human typing moves the caret", async () => {
  const editor = setup();
  let finish: ((result: Result) => void) | undefined;
  try {
    insertTiptapReference(
      editor.view,
      url,
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    editor.view.dispatch(editor.state.tr.insertText("Keep typing"));
    finish?.({
      items: [
        {
          preview: { href: "/pages/target#block=block", status: "ready" },
          target: { blockId: "block", documentId: "target", kind: "document" },
          url,
        },
      ],
    } as Result);
    await vi.waitFor(() =>
      expect(fromTiptapDocument(editor.state.doc)[0]).toMatchObject({
        id: "source",
        props: { blockId: "block", documentId: "target", resolutionToken: "" },
        type: "referenceCard",
      }),
    );
    expect(editor.state.doc.textContent).toContain("Keep typing");
  } finally {
    editor.destroy();
  }
});

test("deleting a pending reference prevents a late resolver from resurrecting it", async () => {
  const editor = setup();
  let finish: ((result: Result) => void) | undefined;
  try {
    insertTiptapReference(
      editor.view,
      url,
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const wrapper = editor.state.doc.firstChild;
    if (!wrapper) throw new Error("Missing card");
    editor.view.dispatch(editor.state.tr.delete(0, wrapper.nodeSize));
    const original = editor.state.doc.toJSON();
    finish?.({ items: [] });
    await Promise.resolve();
    expect(editor.state.doc.toJSON()).toEqual(original);
  } finally {
    editor.destroy();
  }
});

test("resolver failure restores an authored link alias and styles", async () => {
  const editor = setup("Alias");
  try {
    const mark = editor.schema.marks.bold;
    if (!mark) throw new Error("Missing mark");
    const transaction = editor.state.tr.addMark(2, 7, mark.create());
    editor.view.dispatch(
      transaction.setSelection(TextSelection.create(transaction.doc, 2, 7)),
    );
    const before = fromTiptapDocument(editor.state.doc);
    insertTiptapReference(
      editor.view,
      url,
      async () => {
        throw new Error("offline");
      },
      "Alias",
    );
    await vi.waitFor(() => expect(editor.state.doc.textContent).toBe("Alias"));
    expect(fromTiptapDocument(editor.state.doc)).toEqual(before);
  } finally {
    editor.destroy();
  }
});

test("converting the final selected link to a card leaves a writable caret through asynchronous resolution", async () => {
  const editor = setup("Alias");
  try {
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, 2, 7),
      ),
    );
    expect(
      insertTiptapReference(
        editor.view,
        url,
        async () => ({ items: [] }),
        "Alias",
        "referenceCard",
      ),
    ).toBe(true);
    expect(editor.state.selection.$from.parent.type.name).toBe("paragraph");
    editor.view.dispatch(editor.state.tr.insertText("After card"));
    await vi.waitFor(() =>
      expect(fromTiptapDocument(editor.state.doc)[0]).toMatchObject({
        props: { label: "Alias" },
        type: "referenceCard",
      }),
    );
    expect(fromTiptapDocument(editor.state.doc).at(-1)).toMatchObject({
      content: [{ text: "After card" }],
      type: "paragraph",
    });
    editor.state.doc.check();
    expect(editor.isEditable).toBe(true);
  } finally {
    editor.destroy();
  }
});
