// @vitest-environment jsdom
import { createDocumentEditor } from "@acme/better-editor/engine/editor";
import { blockAt } from "@acme/better-editor/engine/identity";
import { fromTiptapDocument } from "@acme/better-editor/serialization/tiptap";
import {
  type DocumentBlock,
  type DocumentOperation,
  parseBlock,
} from "@acme/document";
import { undo } from "@tiptap/pm/history";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { afterEach, expect, test, vi } from "vitest";
import { captureDocumentEditTarget } from "./document-edit-target";

const disposables: Array<() => void> = [];
afterEach(() => {
  for (const dispose of disposables.splice(0)) dispose();
});
const p = (id: string, content = id) =>
  parseBlock({ content, id, type: "paragraph" });
const update = (id: string, content: string): DocumentOperation => ({
  data: { content, type: "paragraph" },
  id,
  type: "update",
});
function fixture(
  blocks: DocumentBlock[] = [p("a", "Before target after"), p("b", "Outside")],
) {
  const onCommit = vi.fn();
  const editor = createDocumentEditor({
    element: document.createElement("div"),
    extensions: [],
    initialBlocks: blocks,
    onCommit,
    resolveUrl: async () => ({ items: [] }),
  });
  disposables.push(() => editor.destroy());
  const textSelection = (id: string, from: number, to: number) => {
    const pos = blockAt(editor.state.doc, id).pos + 2;
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, pos + from, pos + to),
      ),
    );
  };
  const capture = () => {
    const target = captureDocumentEditTarget(editor);
    const mapped = vi.fn(
      (args: { transaction: import("@tiptap/pm/state").Transaction }) =>
        target.map(args.transaction),
    );
    editor.on("transaction", mapped);
    return { mapped, target };
  };
  return {
    blocks: () => fromTiptapDocument(editor.state.doc),
    capture,
    editor,
    onCommit,
    textSelection,
  };
}

test("partial text scope excludes outside writing and preserves rich prefix/suffix", () => {
  const f = fixture([
    parseBlock({
      children: [p("child", "Unselected child")],
      content: [
        { styles: { bold: true }, text: "Before ", type: "text" },
        { styles: {}, text: "target", type: "text" },
        {
          content: [{ styles: {}, text: " after", type: "text" }],
          href: "https://example.com",
          type: "link",
        },
      ],
      id: "a",
      type: "paragraph",
    }),
    p("b"),
  ]);
  f.textSelection("a", 7, 13);
  const { target } = f.capture();
  expect(target.blocks).toHaveLength(1);
  expect(target.blocks[0]?.children).toBeUndefined();
  expect(JSON.stringify(target.blocks)).not.toContain("Before");
  expect(target.apply([update("a", "replacement")])).toBe(true);
  const result = f.blocks()[0];
  expect(result?.children?.[0]?.id).toBe("child");
  expect(result?.content).toEqual([
    { styles: { bold: true }, text: "Before ", type: "text" },
    { styles: {}, text: "replacement", type: "text" },
    {
      content: [{ styles: {}, text: " after", type: "text" }],
      href: "https://example.com",
      type: "link",
    },
  ]);
});

test("outside typing maps the fixed selection and survives final application and undo", () => {
  const f = fixture();
  f.textSelection("a", 7, 13);
  const { target, mapped } = f.capture();
  f.editor.view.dispatch(f.editor.state.tr.insertText("New ", 2));
  expect(mapped.mock.results.at(-1)?.value).toBe(true);
  expect(target.range).toEqual({ from: 13, to: 19 });
  f.textSelection("b", 0, 0);
  expect(mapped.mock.results.at(-1)?.value).toBe(true);
  expect(target.apply([update("a", "AI")])).toBe(true);
  expect(f.editor.state.doc.textContent).toBe("New Before AI afterOutside");
  expect(undo(f.editor.state, f.editor.view.dispatch)).toBe(true);
  expect(f.editor.state.doc.textContent).toBe("New Before target afterOutside");
});

test("overlapping typing cancels and retry uses the same range instead of the collapsed cursor", () => {
  const f = fixture();
  f.textSelection("a", 7, 13);
  const { target, mapped } = f.capture();
  f.editor.view.dispatch(f.editor.state.tr.insertText("human", 9, 15));
  expect(mapped.mock.results.at(-1)?.value).toBe(false);
  expect(target.apply([update("a", "stale")])).toBe(false);
  const retry = target.recapture();
  expect(retry.selection).toBe(true);
  expect(JSON.stringify(retry.blocks)).toContain("human");
  expect(JSON.stringify(retry.blocks)).not.toContain("Before");
  expect(retry.apply([update("a", "fresh")])).toBe(true);
  expect(f.editor.state.doc.textContent).toBe("Before fresh afterOutside");
});

test("overlapping formatting cancels but outside formatting does not", () => {
  const f = fixture();
  f.textSelection("a", 7, 13);
  const { target, mapped } = f.capture();
  const bold = f.editor.state.schema.marks.bold;
  if (!bold) throw new Error("Missing bold schema");
  f.editor.view.dispatch(f.editor.state.tr.addMark(2, 5, bold.create()));
  expect(mapped.mock.results.at(-1)?.value).toBe(true);
  f.editor.view.dispatch(f.editor.state.tr.addMark(10, 12, bold.create()));
  expect(mapped.mock.results.at(-1)?.value).toBe(false);
  expect(target.apply([update("a", "stale")])).toBe(false);
});

test("deleting the target prevents retry from broadening to the document", () => {
  const f = fixture();
  f.textSelection("a", 7, 13);
  const { target } = f.capture();
  f.editor.view.dispatch(f.editor.state.tr.delete(9, 15));
  expect(() => target.recapture()).toThrow("original target");
});

test("whole-document targets cancel on any human content change", () => {
  const f = fixture();
  const { target, mapped } = f.capture();
  expect(target.selection).toBe(false);
  f.editor.view.dispatch(f.editor.state.tr.insertText("Human ", 2));
  expect(mapped.mock.results.at(-1)?.value).toBe(false);
  expect(target.apply([update("a", "stale")])).toBe(false);
  const retry = target.recapture();
  expect(retry.selection).toBe(false);
  expect(JSON.stringify(retry.blocks)).toContain("Human");
});

test("complete sibling scopes permit structural changes without touching outside nodes", () => {
  const f = fixture([p("a"), p("b"), p("c")]);
  const a = blockAt(f.editor.state.doc, "a");
  const b = blockAt(f.editor.state.doc, "b");
  const c = blockAt(f.editor.state.doc, "c").node;
  f.editor.view.dispatch(
    f.editor.state.tr.setSelection(
      TextSelection.create(
        f.editor.state.doc,
        a.pos + 2,
        b.pos + b.node.nodeSize - 2,
      ),
    ),
  );
  const { target } = f.capture();
  expect(target.blocks.map((block) => block.id)).toEqual(["a", "b"]);
  expect(
    target.apply([{ id: "b", type: "remove" }, update("a", "Merged")]),
  ).toBe(true);
  expect(f.blocks().map((block) => block.id)).toEqual(["a", "c"]);
  expect(blockAt(f.editor.state.doc, "c").node).toBe(c);
});

test("complete nested block scopes retain the parent and siblings", () => {
  const f = fixture([
    { ...p("parent"), children: [p("child"), p("sibling")] },
    p("outside"),
  ]);
  const child = blockAt(f.editor.state.doc, "child");
  f.editor.view.dispatch(
    f.editor.state.tr.setSelection(
      NodeSelection.create(f.editor.state.doc, child.pos),
    ),
  );
  const { target } = f.capture();
  expect(target.apply([update("child", "Edited")])).toBe(true);
  expect(f.blocks()[0]?.children?.map((block) => block.id)).toEqual([
    "child",
    "sibling",
  ]);
  expect(f.editor.state.doc.textContent).toBe("parentEditedsiblingoutside");
});

test("scoped inserted IDs cannot capture an existing outside block", () => {
  const f = fixture([p("outside", "Keep me"), p("selected", "Target")]);
  const selected = blockAt(f.editor.state.doc, "selected");
  f.editor.view.dispatch(
    f.editor.state.tr.setSelection(
      NodeSelection.create(f.editor.state.doc, selected.pos),
    ),
  );
  const { target } = f.capture();
  const before = f.editor.state.doc;
  expect(() =>
    target.apply([
      {
        afterId: "selected",
        block: p("outside", "Malicious collision"),
        parentId: null,
        type: "insert",
      },
    ]),
  ).toThrow();
  expect(f.editor.state.doc).toBe(before);
  expect(f.onCommit).not.toHaveBeenCalled();
  expect(undo(f.editor.state, f.editor.view.dispatch)).toBe(false);
});

test.each(["document", "blocks", "inline"])(
  "semantic no-op %s edits complete without save or undo",
  (kind) => {
    const f = fixture();
    if (kind === "blocks") f.textSelection("a", 0, 19);
    if (kind === "inline") f.textSelection("a", 7, 13);
    const { target } = f.capture();
    const before = f.editor.state.doc;
    const content = kind === "inline" ? "target" : "Before target after";
    expect(target.apply([update("a", content)])).toBe(true);
    expect(f.editor.state.doc).toBe(before);
    expect(f.onCommit).not.toHaveBeenCalled();
    expect(undo(f.editor.state, f.editor.view.dispatch)).toBe(false);
  },
);

test("partial selections reject structure changes rather than rewrite outside text", () => {
  const f = fixture();
  f.textSelection("a", 7, 13);
  const { target } = f.capture();
  const before = f.editor.state.doc;
  expect(() =>
    target.apply([
      {
        data: { content: "Title", props: { level: 2 }, type: "heading" },
        id: "a",
        type: "update",
      },
    ]),
  ).toThrow("structure outside");
  expect(f.editor.state.doc).toBe(before);
  expect(f.onCommit).not.toHaveBeenCalled();
});

test("partial selections spanning paragraphs reject capture instead of widening", () => {
  const f = fixture();
  const b = blockAt(f.editor.state.doc, "b");
  f.editor.view.dispatch(
    f.editor.state.tr.setSelection(
      TextSelection.create(f.editor.state.doc, 5, b.pos + 4),
    ),
  );
  expect(() => captureDocumentEditTarget(f.editor)).toThrow(
    "complete sibling blocks",
  );
});

test.each(["readonly", "destroyed"])(
  "retained target rejects a %s editor",
  (state) => {
    const f = fixture();
    const { target } = f.capture();
    if (state === "readonly") f.editor.setEditable(false, false);
    else f.editor.destroy();
    expect(target.apply([update("a", "No")])).toBe(false);
    expect(() => target.recapture()).toThrow("original target");
    expect(f.onCommit).not.toHaveBeenCalled();
  },
);
