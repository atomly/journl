// @vitest-environment jsdom
import { createDocumentEditor } from "@acme/better-editor/engine/editor";
import { blockAt } from "@acme/better-editor/engine/identity";
import { tableExtensions } from "@acme/better-editor/engine/table-schema";
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
    extensions: tableExtensions(),
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
  f.textSelection("b", 0, 0);
  expect(mapped.mock.results.at(-1)?.value).toBe(true);
  expect(target.apply([update("a", "AI")])).toBe(true);
  expect(f.editor.state.doc.textContent).toBe("New Before AI afterOutside");
  expect(undo(f.editor.state, f.editor.view.dispatch)).toBe(true);
  expect(f.editor.state.doc.textContent).toBe("New Before target afterOutside");
});

test("overlapping typing invalidates the retained target without changing human writing", () => {
  const f = fixture();
  f.textSelection("a", 7, 13);
  const { target, mapped } = f.capture();
  f.editor.view.dispatch(f.editor.state.tr.insertText("human", 9, 15));
  expect(mapped.mock.results.at(-1)?.value).toBe(false);
  expect(target.apply([update("a", "stale")])).toBe(false);
  expect(f.editor.state.doc.textContent).toBe("Before human afterOutside");
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

test("deleting selected text prevents a retained action from broadening to the document", () => {
  const f = fixture();
  f.textSelection("a", 7, 13);
  const { target } = f.capture();
  f.editor.view.dispatch(f.editor.state.tr.delete(9, 15));
  expect(target.apply([update("a", "stale")])).toBe(false);
});

test("whole-document targets cancel on any human content change", () => {
  const f = fixture();
  const { target, mapped } = f.capture();
  f.editor.view.dispatch(f.editor.state.tr.insertText("Human ", 2));
  expect(mapped.mock.results.at(-1)?.value).toBe(false);
  expect(target.apply([update("a", "stale")])).toBe(false);
  const next = captureDocumentEditTarget(f.editor);
  expect(JSON.stringify(next.blocks)).toContain("Human");
});

test("a second request retains document scope after a generated trailing divider", () => {
  const f = fixture([p("starter", "")]);
  const { target } = f.capture();
  expect(
    target.apply([
      { id: "starter", type: "remove" },
      {
        afterId: null,
        block: parseBlock({
          content: 'console.log("ready");',
          id: "code",
          props: { language: "javascript" },
          type: "codeBlock",
        }),
        parentId: null,
        type: "insert",
      },
      {
        afterId: "code",
        block: parseBlock({ id: "divider", type: "divider" }),
        parentId: null,
        type: "insert",
      },
    ]),
  ).toBe(true);
  const second = captureDocumentEditTarget(f.editor);
  expect(second.blocks.map((block) => block.id)).toEqual(["code", "divider"]);
  expect(
    second.apply([
      {
        data: {
          content: 'fn main() { println!("ready"); }',
          props: { language: "rust" },
          type: "codeBlock",
        },
        id: "code",
        type: "update",
      },
    ]),
  ).toBe(true);
  expect(f.blocks()[0]).toMatchObject({
    id: "code",
    props: { language: "rust" },
  });
  expect(f.blocks()[1]?.id).toBe("divider");
});

test.each(["loaded", "generated"])(
  "%s atom-only documents keep document scope for the next request",
  (phase) => {
    const atoms = [
      parseBlock({ id: "divider", type: "divider" }),
      parseBlock({
        id: "image",
        props: { url: "https://example.com/image.png" },
        type: "image",
      }),
    ];
    const f = fixture(phase === "loaded" ? atoms : [p("starter", "")]);
    if (phase === "generated") {
      const first = captureDocumentEditTarget(f.editor);
      expect(
        first.apply([
          { id: "starter", type: "remove" },
          ...atoms.map((block, index) => ({
            afterId: index ? "divider" : null,
            block,
            parentId: null,
            type: "insert" as const,
          })),
        ]),
      ).toBe(true);
    }
    const target = captureDocumentEditTarget(f.editor);
    expect(target.blocks.map((block) => block.id)).toEqual([
      "divider",
      "image",
    ]);
    expect(
      target.apply([
        {
          afterId: "image",
          block: p("new", "New writing"),
          parentId: null,
          type: "insert",
        },
      ]),
    ).toBe(true);
    expect(f.blocks().slice(0, 2)).toEqual(atoms);
    expect(f.blocks()[2]?.id).toBe("new");
  },
);

test("an explicit atom wrapper selection stays scoped to that block", () => {
  const f = fixture([
    parseBlock({ id: "divider", type: "divider" }),
    parseBlock({ id: "image", type: "image" }),
  ]);
  f.editor.view.dispatch(
    f.editor.state.tr.setSelection(NodeSelection.create(f.editor.state.doc, 0)),
  );
  const target = captureDocumentEditTarget(f.editor);
  expect(target.blocks.map((block) => block.id)).toEqual(["divider"]);
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
    expect(f.onCommit).not.toHaveBeenCalled();
  },
);

test.each([false, true])(
  "table cell text stays an exact inline scope (whole cell: %s)",
  (wholeCell) => {
    const f = fixture([
      parseBlock({
        content: {
          rows: [
            { cells: ["Before target after", "Untouched neighbor"] },
            { cells: ["Second row", "Last cell"] },
          ],
          type: "tableContent",
        },
        id: "table",
        type: "table",
      }),
      p("outside"),
    ]);
    let start = -1;
    f.editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "tableParagraph" && start < 0) start = pos + 1;
    });
    const from = start + (wholeCell ? 0 : 7);
    const to = start + (wholeCell ? 19 : 13);
    f.editor.view.dispatch(
      f.editor.state.tr.setSelection(
        TextSelection.create(f.editor.state.doc, from, to),
      ),
    );
    const before = f.editor.state.doc;
    const { target } = f.capture();
    expect(target.blocks).toEqual([
      parseBlock({
        content: [
          {
            styles: {},
            text: wholeCell ? "Before target after" : "target",
            type: "text",
          },
        ],
        id: "table",
        type: "paragraph",
      }),
    ]);
    const structural: DocumentOperation[] = [
      {
        data: {
          content: "No broadening",
          props: { level: 2 },
          type: "heading",
        },
        id: "table",
        type: "update",
      },
    ];
    expect(() => target.preview(structural)).toThrow("Select complete blocks");
    expect(() => target.apply(structural)).toThrow("outside the selected text");
    expect(f.editor.state.doc).toBe(before);
    expect(f.onCommit).not.toHaveBeenCalled();
    const operations = [update("table", "replacement")];
    expect(target.preview(operations).textContent).toContain(
      "Untouched neighbor",
    );
    expect(f.editor.state.doc).toBe(before);
    expect(target.apply(operations)).toBe(true);
    const expected = before.type.schema.nodeFromJSON(before.toJSON());
    expect(f.editor.state.doc.textContent).toBe(
      wholeCell
        ? "replacementUntouched neighborSecond rowLast celloutside"
        : "Before replacement afterUntouched neighborSecond rowLast celloutside",
    );
    expect(undo(f.editor.state, f.editor.view.dispatch)).toBe(true);
    expect(f.editor.state.doc.eq(expected)).toBe(true);
  },
);

test("text spanning table cells does not expand to the whole table", () => {
  const f = fixture([
    parseBlock({
      content: { rows: [{ cells: ["First", "Second"] }], type: "tableContent" },
      id: "table",
      type: "table",
    }),
  ]);
  const ranges: { from: number; to: number }[] = [];
  f.editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "tableParagraph")
      ranges.push({ from: pos + 1, to: pos + 1 + node.content.size });
  });
  const [first, second] = ranges;
  if (!first || !second) throw new Error("Missing table cells");
  f.editor.view.dispatch(
    f.editor.state.tr.setSelection(
      TextSelection.create(f.editor.state.doc, first.from, second.to),
    ),
  );
  expect(() => f.capture()).toThrow("Select text within one paragraph");
  expect(f.onCommit).not.toHaveBeenCalled();
});
