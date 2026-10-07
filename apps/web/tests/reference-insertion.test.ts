// @vitest-environment jsdom

import { schema } from "@acme/blocknote/schema";
import { BlockNoteEditor } from "@blocknote/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import {
  handleReferencePaste,
  insertReferenceUrl,
} from "../src/components/editor/reference-insertion";
import type { RouterOutputs } from "../src/trpc";

beforeAll(() => {
  // jsdom omits ClipboardEvent; ProseMirror creates one for its paste API.
  vi.stubGlobal("ClipboardEvent", class extends Event {});
});
afterAll(() => vi.unstubAllGlobals());

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

function clipboardEvent(text: string, html = "") {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: {
      getData: (type: string) =>
        type === "text/plain" ? text : type === "text/html" ? html : "",
      types: html ? ["text/plain", "text/html"] : ["text/plain"],
    },
  });
  return event;
}

async function mountedEditor(type: "paragraph" | "codeBlock" = "paragraph") {
  const element = document.createElement("div");
  document.body.append(element);
  const editor = BlockNoteEditor.create({
    initialContent: [{ id: SOURCE, type }],
    pasteHandler: (context) =>
      handleReferencePaste(context, async () => unavailable),
    schema,
  });
  editor.mount(element);
  editor.setTextCursorPosition(SOURCE, "end");
  return {
    cleanup: () => {
      editor.unmount();
      element.remove();
    },
    editor,
    paste: (text: string, html = "") =>
      editor.prosemirrorView.dom.dispatchEvent(clipboardEvent(text, html)),
  };
}

test("real DOM paste creates cards for plain and browser HTML URLs", async () => {
  for (const html of [
    "",
    `<meta charset="utf-8"><a href="${github}">${github}</a>`,
  ]) {
    const { editor, paste, cleanup } = await mountedEditor();
    try {
      paste(github, html);
      await vi.waitFor(() =>
        expect(
          editor.document.some((block) => block.type === "referenceCard"),
        ).toBe(true),
      );
      editor.prosemirrorView.state.doc.check();
      expect(editor.document[0]?.id).toBe(SOURCE);
    } finally {
      cleanup();
    }
  }
});

test("real DOM paste preserves text, multiline Markdown, and rich HTML", async () => {
  for (const [text, html, expected] of [
    ["Hello clipboard", "", "Hello clipboard"],
    ["First paragraph\n\nSecond paragraph", "", "Second paragraph"],
    ["Formatted", "<p><strong>Formatted</strong></p>", "Formatted"],
    ["Repository", `<a href="${github}">Repository</a>`, "Repository"],
  ]) {
    const { editor, paste, cleanup } = await mountedEditor();
    try {
      paste(text ?? "", html);
      await vi.waitFor(() =>
        expect(editor.prosemirrorView.state.doc.textContent).toContain(
          expected,
        ),
      );
      expect(
        editor.document.some((block) => block.type === "referenceCard"),
      ).toBe(false);
      editor.prosemirrorView.state.doc.check();
    } finally {
      cleanup();
    }
  }
});

test("real DOM paste leaves URLs in code blocks as text", async () => {
  const { editor, paste, cleanup } = await mountedEditor("codeBlock");
  try {
    paste(github);
    await vi.waitFor(() =>
      expect(editor.prosemirrorView.state.doc.textContent).toContain(github),
    );
    expect(editor.document[0]?.type).toBe("codeBlock");
  } finally {
    cleanup();
  }
});
