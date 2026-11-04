import { EditorState } from "@tiptap/pm/state";
import { expect, test, vi } from "vitest";
import { toTiptapDocument } from "../serialization/tiptap";
import { blockAt, identityPlugin } from "./identity";

test("immutable block lookups stay stable and new documents use new positions", () => {
  const doc = toTiptapDocument([
    { content: "First", id: "a", type: "paragraph" },
    { content: "Second", id: "b", type: "paragraph" },
  ]);
  const previous = blockAt(doc, "b");
  expect(blockAt(doc, "b")).toBe(previous);
  const longer = EditorState.create({ doc }).tr.insertText("Added", 2).doc;
  expect(blockAt(longer, "b").pos).toBe(previous.pos + 5);
  expect(blockAt(doc, "b")).toBe(previous);
  const removed = EditorState.create({ doc }).tr.delete(
    previous.pos,
    previous.pos + previous.node.nodeSize,
  ).doc;
  expect(() => blockAt(removed, "b")).toThrow("Block not found");
});

test("typing after identity validation does not scan either document for block IDs", () => {
  const doc = toTiptapDocument(
    Array.from({ length: 1000 }, (_, i) => ({
      content: "Text",
      id: `p-${i}`,
      type: "paragraph" as const,
    })),
  );
  let nextId = 0;
  const plugin = identityPlugin(() => `new-${++nextId}`);
  let state = EditorState.create({ doc, plugins: [plugin] });
  // The first edit validates the initial identities; later inline edits preserve them.
  state = state.applyTransaction(state.tr.insertText("!", 2)).state;
  const tr = state.tr.insertText("?", 2);
  const previousWalk = vi.spyOn(state.doc, "descendants");
  const nextWalk = vi.spyOn(tr.doc, "descendants");
  state.applyTransaction(tr);
  expect(previousWalk).not.toHaveBeenCalled();
  expect(nextWalk).not.toHaveBeenCalled();
  previousWalk.mockRestore();
  nextWalk.mockRestore();
});

test("the first inline edit still repairs invalid initial identities", () => {
  const valid = toTiptapDocument([
    { content: "Text", id: "a", type: "paragraph" },
  ]);
  const first = valid.firstChild;
  if (!first) throw new Error("Missing fixture block");
  const doc = valid.type.create(null, [first, first]);
  let nextId = 0;
  const state = EditorState.create({
    doc,
    plugins: [identityPlugin(() => `new-${++nextId}`)],
  });
  const next = state.applyTransaction(state.tr.insertText("!", 2)).state;
  const ids: string[] = [];
  next.doc.forEach((node) => {
    ids.push(node.attrs.id);
  });
  expect(new Set(ids).size).toBe(2);
});
