// @vitest-environment jsdom

import { schema } from "@acme/blocknote/schema";
import { BlockNoteEditor } from "@blocknote/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { expect, test, vi } from "vitest";
import { insertReferenceUrl } from "../src/components/editor/reference-insertion";
import type { RouterOutputs } from "../src/trpc";

const SOURCE = "10000000-0000-4000-8000-000000000001";
const DOCUMENT = "20000000-0000-4000-8000-000000000002";
const PAGE = "30000000-0000-4000-8000-000000000003";
const github = "https://github.com/atomly/journl/issues/291";
const unavailable = { items: [] } as RouterOutputs["references"]["resolveUrls"];

function makeView(content = "") {
  const editor = BlockNoteEditor.create({
    initialContent: [{ content, id: SOURCE, type: "paragraph" }],
    schema,
  });
  let state = EditorState.create({
    doc: editor._tiptapEditor.state.doc,
    schema: editor._tiptapEditor.state.schema,
  });
  const position = 3 + content.length;
  state = state.apply(
    state.tr.setSelection(TextSelection.create(state.doc, position)),
  );
  const view = {
    dispatch(transaction: Parameters<EditorView["dispatch"]>[0]) {
      state = state.apply(transaction);
    },
    isDestroyed: false,
    get state() {
      return state;
    },
  } as unknown as EditorView;
  return view;
}

function findNodes(view: EditorView, type: string) {
  const nodes: Array<{ props: Record<string, unknown>; text: string }> = [];
  view.state.doc.descendants((node) => {
    if (node.type.name === type)
      nodes.push({ props: node.attrs, text: node.textContent });
  });
  return nodes;
}

test("pasting a standalone URL creates a card inside the existing BlockNote container", async () => {
  const view = makeView();
  expect(view.state.selection.$from.depth).toBe(3);
  expect(
    insertReferenceUrl(view, github, async () => unavailable, undefined, true),
  ).toBe(true);
  view.state.doc.check();
  expect(findNodes(view, "referenceCard")).toHaveLength(1);
  expect(findNodes(view, "blockContainer")[0]?.props.id).toBe(SOURCE);
  expect(findNodes(view, "paragraph")).toHaveLength(1);
  expect(view.state.selection.$from.parent.type.name).toBe("paragraph");
  await vi.waitFor(() =>
    expect(findNodes(view, "referenceCard")[0]?.props.resolutionToken).toBe(""),
  );
});

test("pasting within existing text creates an inline badge and preserves that text", () => {
  const view = makeView("Related: ");
  expect(
    insertReferenceUrl(view, github, async () => unavailable, undefined, true),
  ).toBe(true);
  view.state.doc.check();
  expect(findNodes(view, "contentReference")).toHaveLength(1);
  expect(findNodes(view, "referenceCard")).toHaveLength(0);
  expect(view.state.doc.textContent).toContain("Related: ");
});

test("a same-preview URL resolves as an internal route even with a production base URL", async () => {
  const view = makeView();
  const url = `${window.location.origin}/pages/${PAGE}#block=${SOURCE}`;
  const resolve = vi.fn(
    async () =>
      ({
        items: [
          {
            preview: {
              href: `https://production.example/pages/${PAGE}#block=${SOURCE}`,
              kind: "page",
              status: "ready",
              title: "Referenced page",
            },
            target: { blockId: SOURCE, documentId: DOCUMENT, kind: "document" },
            url,
          },
        ],
      }) as RouterOutputs["references"]["resolveUrls"],
  );
  insertReferenceUrl(view, url, resolve);
  expect(resolve).toHaveBeenCalledWith(`/pages/${PAGE}#block=${SOURCE}`);
  await vi.waitFor(() =>
    expect(findNodes(view, "referenceCard")[0]?.props.documentId).toBe(
      DOCUMENT,
    ),
  );
  expect(findNodes(view, "referenceCard")[0]?.props.targetKind).toBe(
    "document",
  );
  view.state.doc.check();
});

test("resolver failures restore the URL without losing the source block ID", async () => {
  const view = makeView();
  insertReferenceUrl(view, github, async () => {
    throw new Error("disabled");
  });
  await vi.waitFor(() =>
    expect(findNodes(view, "referenceCard")).toHaveLength(0),
  );
  view.state.doc.check();
  expect(view.state.doc.textContent).toContain(github);
  expect(findNodes(view, "blockContainer")[0]?.props.id).toBe(SOURCE);
});
