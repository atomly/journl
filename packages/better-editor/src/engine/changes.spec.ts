import { applyDocumentOperations, type DocumentBlock } from "@acme/document";
import { expect, test } from "vitest";
import { fromTiptapDocument, toTiptapDocument } from "../serialization/tiptap";
import { documentChanges } from "./changes";

const canonical = (blocks: readonly DocumentBlock[]) =>
  fromTiptapDocument(toTiptapDocument(blocks));

test("data-only changes produce minimal operations and preserve nested structure", () => {
  const before = canonical([
    {
      children: [{ content: "Child", id: "child", type: "paragraph" }],
      content: "Parent",
      id: "parent",
      type: "paragraph",
    },
    { content: "Last", id: "last", type: "paragraph" },
  ]);
  const after = canonical([
    {
      children: [{ content: "Changed", id: "child", type: "paragraph" }],
      content: "Parent",
      id: "parent",
      type: "paragraph",
    },
    { content: "Last!", id: "last", type: "paragraph" },
  ]);
  const untouched = structuredClone(before);
  const operations = documentChanges(before, toTiptapDocument(after));
  expect(
    operations.map(({ type, ...operation }) => ({
      id: "id" in operation ? operation.id : null,
      type,
    })),
  ).toEqual([
    { id: "child", type: "update" },
    { id: "last", type: "update" },
  ]);
  expect(applyDocumentOperations(before, operations)).toEqual(after);
  expect(before).toEqual(untouched);
  expect(documentChanges(after, toTiptapDocument(after))).toEqual([]);
});

test("structural fallback moves surviving descendants before removing their parent", () => {
  const before = canonical([
    {
      children: [{ content: "Keep", id: "child", type: "paragraph" }],
      id: "parent",
      type: "paragraph",
    },
    { id: "last", type: "paragraph" },
  ]);
  const after = canonical([
    { id: "last", type: "paragraph" },
    { content: "Keep!", id: "child", type: "paragraph" },
    { id: "new", type: "paragraph" },
  ]);
  const operations = documentChanges(before, toTiptapDocument(after));
  expect(applyDocumentOperations(before, operations)).toEqual(after);
  expect(
    operations.findIndex((op) => op.type === "move" && op.id === "child"),
  ).toBeLessThan(
    operations.findIndex((op) => op.type === "remove" && op.id === "parent"),
  );
});

test("targeted block edits preserve untouched ProseMirror nodes", async () => {
  const { EditorState } = await import("@tiptap/pm/state");
  const { editBlocks } = await import("./commands");
  const original = toTiptapDocument([
    { content: "A", id: "a", type: "paragraph" },
    { content: "B", id: "b", type: "paragraph" },
  ]);
  const state = EditorState.create({ doc: original });
  const transaction = editBlocks(state.tr, [
    {
      data: { content: "Changed", type: "paragraph" },
      id: "a",
      type: "update",
    },
  ]);
  expect(transaction.doc.child(1)).toBe(original.child(1));
  expect(
    transaction.steps.some(
      (step) =>
        step.toJSON().from === 0 && step.toJSON().to === original.content.size,
    ),
  ).toBe(false);
  expect(fromTiptapDocument(transaction.doc)[0]?.content).toEqual([
    { styles: {}, text: "Changed", type: "text" },
  ]);
});

test("a late invalid structural operation leaves the caller transaction untouched", async () => {
  const { EditorState } = await import("@tiptap/pm/state");
  const { editBlocks } = await import("./commands");
  const original = toTiptapDocument([
    { content: "A", id: "a", type: "paragraph" },
    { content: "B", id: "b", type: "paragraph" },
  ]);
  const input = EditorState.create({ doc: original }).tr;
  expect(() =>
    editBlocks(input, [
      { id: "a", type: "remove" },
      { afterId: null, id: "missing", parentId: null, type: "move" },
    ]),
  ).toThrow();
  expect(input.doc).toBe(original);
  expect(input.steps).toHaveLength(0);
});

test("targeted mixed structural batches match the document operation contract", async () => {
  const { EditorState } = await import("@tiptap/pm/state");
  const { editBlocks } = await import("./commands");
  let state = EditorState.create({
    doc: toTiptapDocument([
      {
        children: [{ content: "Nested", id: "child", type: "paragraph" }],
        content: "Parent",
        id: "parent",
        type: "paragraph",
      },
      { content: "Sibling", id: "sibling", type: "paragraph" },
    ]),
  });
  let seed = 423;
  const pick = (length: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor((seed / 0x100000000) * length);
  };
  let accepted = 0;
  const kinds = new Set<string>();
  for (let batch = 0; batch < 40; batch++) {
    let expected = fromTiptapDocument(state.doc);
    const operations: import("@acme/document").DocumentOperation[] = [];
    for (let offset = 0; offset < 3; offset++) {
      const all: DocumentBlock[] = [];
      const visit = (blocks: readonly DocumentBlock[]) => {
        for (const block of blocks) {
          all.push(block);
          visit(block.children ?? []);
        }
      };
      visit(expected);
      const target = all[pick(Math.max(1, all.length))];
      const parent = all[pick(all.length + 1)];
      const siblings = parent ? (parent.children ?? []) : expected;
      const afterId = siblings[pick(siblings.length + 1)]?.id ?? null;
      const parentId = parent?.id ?? null;
      const type = target ? pick(4) : 0;
      const operation: import("@acme/document").DocumentOperation =
        type === 0 || !target
          ? {
              afterId,
              block: {
                content: `Inserted ${batch}:${offset}`,
                id: `new-${batch}-${offset}`,
                type: "paragraph",
              },
              parentId,
              type: "insert",
            }
          : type === 1
            ? { afterId, id: target.id, parentId, type: "move" }
            : type === 2
              ? {
                  data: { content: `Updated ${batch}`, type: "paragraph" },
                  id: target.id,
                  type: "update",
                }
              : { id: target.id, type: "remove" };
      try {
        expected = applyDocumentOperations(expected, [operation]);
        operations.push(operation);
        accepted++;
        kinds.add(operation.type);
      } catch {
        // The domain rejects generated cycles and invalid sibling destinations.
      }
    }
    state = state.apply(editBlocks(state.tr, operations));
    expect(fromTiptapDocument(state.doc)).toEqual(canonical(expected));
  }
  expect(accepted).toBeGreaterThan(60);
  expect([...kinds].sort()).toEqual(["insert", "move", "remove", "update"]);
});
