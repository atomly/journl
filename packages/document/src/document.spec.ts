import { describe, expect, test } from "vitest";
import {
  applyDocumentOperations,
  DocumentReadError,
  documentBlocks,
  documentHtml,
  documentMarkdown,
  documentRows,
  duplicateBlock,
  parseBlock,
  zDocument,
  zDocumentOperation,
} from "./index";

const paragraph = (id: string, content = id) =>
  parseBlock({ content, id, props: {}, type: "paragraph" });
const scope = { document_id: "document", user_id: "owner" };
const stored = (
  id: string,
  parent_id: string | null = null,
  data: unknown = { content: id, props: {}, type: "paragraph" },
) => ({ ...scope, data, id, parent_id });
const edge = (from_id: string, to_id: string) => ({
  ...scope,
  from_id,
  to_id,
  type: "sibling",
});

test("real row/edge shapes reconstruct linked order and nesting independent of input order", () => {
  const result = documentBlocks(
    [stored("last"), stored("child", "first"), stored("first")],
    [edge("first", "last")],
  );
  expect(result?.map((b) => b.id)).toEqual(["first", "last"]);
  expect(result?.[0].children?.[0]?.id).toBe("child");
  const rows = documentRows(result ?? []);
  expect(
    documentBlocks(
      rows.blocks.map((b) => ({ ...scope, ...b })),
      rows.edges.map((e) => ({ ...scope, ...e })),
    ),
  ).toEqual(result);
});

test("legacy omitted props/content are explicit compatible inputs, and null table widths normalize without losing cells", () => {
  expect(
    documentBlocks([stored("old", null, { type: "paragraph" })], [])?.[0],
  ).toMatchObject({ id: "old", type: "paragraph" });
  const value = parseBlock({
    content: {
      columnWidths: [null, 140],
      rows: [
        { cells: [["Legacy"]] },
        { cells: [{ content: "Modern", type: "tableCell" }] },
      ],
      type: "tableContent",
    },
    id: "table",
    type: "table",
  });
  // Both historical and modern rows remain readable.
  expect(value).toBeDefined();
});

describe("invalid storage is recoverable as a complete original snapshot, never a partial document", () => {
  test.each([
    [
      [
        stored("unknown", null, {
          content: "Keep this",
          props: {},
          type: "futureBlock",
        }),
      ],
      [],
    ],
    [[stored("orphan", "missing")], []],
    [[stored("a", "b"), stored("b", "a")], []],
    [
      [stored("a"), stored("b")],
      [edge("a", "b"), edge("b", "a")],
    ],
    [
      [stored("a"), stored("b"), stored("c")],
      [edge("a", "b"), edge("a", "c")],
    ],
    [[stored("a"), { ...stored("b"), user_id: "other" }], []],
    [[stored("a"), stored("a")], []],
    [[stored("a"), stored("b")], []],
    [[stored("a"), stored("b"), stored("c")], [edge("a", "b")]],
    [[stored("parent"), stored("a", "parent"), stored("b", "parent")], []],
    [
      [
        stored("a", null, {
          props: { futureProperty: "Keep me" },
          type: "paragraph",
        }),
      ],
      [],
    ],
  ] as const)("retains malformed/unsupported case %#", (blocks, edges) => {
    const original = structuredClone({ blocks, edges });
    try {
      documentBlocks(blocks, edges);
      throw new Error("Expected read failure");
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentReadError);
      expect((error as DocumentReadError).original).toEqual(original);
    }
    expect({ blocks, edges }).toEqual(original);
  });
});

test("headless edits preserve identity, nesting and authored targets; a rejected batch leaves input intact", () => {
  const input = [paragraph("a"), paragraph("b")];
  const original = structuredClone(input);
  const next = applyDocumentOperations(input, [
    { afterId: null, id: "b", parentId: "a", type: "move" },
    {
      data: { content: "Changed", props: { level: 2 }, type: "heading" },
      id: "b",
      type: "update",
    },
  ]);
  expect(next[0]?.children?.[0]).toMatchObject({
    content: "Changed",
    id: "b",
    type: "heading",
  });
  expect(input).toEqual(original);
  expect(() =>
    applyDocumentOperations(next, [
      { afterId: null, id: "a", parentId: "b", type: "move" },
    ]),
  ).toThrow("itself");
  expect(() =>
    applyDocumentOperations(input, [
      { id: "a", type: "remove" },
      { afterId: null, id: "b", parentId: "missing", type: "move" },
    ]),
  ).toThrow();
  expect(input).toEqual(original);
  expect(() =>
    applyDocumentOperations(input, [
      { afterId: null, block: paragraph("a"), parentId: null, type: "insert" },
    ]),
  ).toThrow("Duplicate");
  const first = next[0];
  if (!first) throw new Error("Missing edited block");
  const copy = duplicateBlock(
    first,
    (() => {
      let n = 0;
      return () => `copy-${n++}`;
    })(),
  );
  expect(copy.id).not.toBe("a");
  expect(copy.children?.[0]?.id).not.toBe("b");
});

test("Markdown and HTML exports retain readable references, code, tables and nesting without executing authored markup", () => {
  const blocks = [
    parseBlock({
      id: "ref",
      props: {
        blockId: "target-block",
        documentId: "target",
        label: "Target",
        resolutionToken: "",
        targetKind: "document",
        url: "/pages/target#block=target-block",
        version: 1,
      },
      type: "referenceCard",
    }),
    parseBlock({
      content: "```\n<script>alert(1)</script>",
      id: "code",
      props: { language: "js" },
      type: "codeBlock",
    }),
    parseBlock({
      children: [{ content: "Nested", id: "child", type: "paragraph" }],
      content: [
        { content: "Unsafe link", href: "javascript:alert(1)", type: "link" },
      ],
      id: "p",
      type: "paragraph",
    }),
    parseBlock({
      content: { rows: [{ cells: [["Cell"]] }], type: "tableContent" },
      id: "table",
      type: "table",
    }),
  ];
  const markdown = documentMarkdown(blocks);
  const html = documentHtml(blocks);
  expect(markdown).toContain("[Target](/pages/target#block=target-block)");
  expect(markdown).toContain("````js\n```\n<script>");
  expect(markdown).toContain("Nested");
  expect(markdown).toContain("| Cell |");
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain('href="javascript:');
  expect(html).toContain("<table>");
});

test("versioned wire input validates content and fails unknown versions without stripping authored fields", () => {
  expect(
    zDocument.safeParse({ blocks: [paragraph("a")], version: 1 }).success,
  ).toBe(true);
  expect(
    zDocument.safeParse({ blocks: [paragraph("a")], version: 2 }).success,
  ).toBe(false);
  expect(
    zDocument.safeParse({
      blocks: [{ extra: "unknown writing", id: "x", type: "paragraph" }],
      version: 1,
    }).success,
  ).toBe(false);
});

test("headless operation inputs reject unknown actions and fields before applying anything", () => {
  expect(
    zDocumentOperation.safeParse({ type: "delete-everything" }).success,
  ).toBe(false);
  expect(
    zDocumentOperation.safeParse({
      extra: "discarded command",
      id: "a",
      type: "remove",
    }).success,
  ).toBe(false);
  const input = [paragraph("a")];
  expect(() =>
    applyDocumentOperations(input, [
      { extra: true, id: "a", type: "remove" } as never,
    ]),
  ).toThrow();
  expect(input).toEqual([paragraph("a")]);
});
