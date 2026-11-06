import {
  applyDocumentOperations,
  type DocumentOperation,
  parseBlock,
} from "@acme/document";
import { expect, test, vi } from "vitest";
import { z } from "zod";
import { createWriterIdentityMap } from "./document-writer-ids";

const before = [
  parseBlock({ content: "Keep", id: "existing", type: "paragraph" }),
];
const insert = (
  id: string,
  afterId: string | null = "existing",
): DocumentOperation => ({
  afterId,
  block: { content: id, id, type: "paragraph" },
  parentId: null,
  type: "insert",
});

test("model labels and malformed UUIDs become stable application IDs across partial and final batches", () => {
  const assign = createWriterIdentityMap(before);
  const malformed = "3e2f1a0b-9c8d-4e3f-0a1b-9c8d7e6f4455";
  const operations = [insert("first"), insert(malformed, "first")];
  const first = assign(operations.slice(0, 1));
  const final = assign(operations);
  expect(final[0]).toEqual(first[0]);
  const accepted = applyDocumentOperations(before, final);
  expect(accepted[0]?.id).toBe("existing");
  expect(
    accepted.slice(1).every((block) => z.uuid().safeParse(block.id).success),
  ).toBe(true);
  expect(accepted.map((block) => block.content)).toEqual(
    before
      .concat([
        parseBlock({ content: "first", id: "x", type: "paragraph" }),
        parseBlock({ content: malformed, id: "y", type: "paragraph" }),
      ])
      .map((block) => block.content),
  );
  expect(final[1]).toMatchObject({ afterId: accepted[1]?.id });
});

test("nested labels and later update, move and remove references use the same assigned identities", () => {
  const operations: DocumentOperation[] = [
    {
      afterId: "existing",
      block: {
        children: [{ content: "Before", id: "child", type: "paragraph" }],
        id: "parent",
        type: "paragraph",
      },
      parentId: null,
      type: "insert",
    },
    {
      data: { content: "After", type: "paragraph" },
      id: "child",
      type: "update",
    },
    { afterId: "parent", id: "child", parentId: null, type: "move" },
    { id: "parent", type: "remove" },
  ];
  const assign = createWriterIdentityMap(before);
  const output = assign(operations);
  const accepted = applyDocumentOperations(before, output);
  expect(accepted).toHaveLength(2);
  expect(accepted[0]?.id).toBe("existing");
  expect(accepted[1]?.content).toBe("After");
  expect(z.uuid().safeParse(accepted[1]?.id).success).toBe(true);
  expect(operations[1]).toMatchObject({ id: "child" });
});

test.each([
  { operations: [insert("existing")] },
  { operations: [insert("duplicate"), insert("duplicate")] },
])(
  "duplicate model labels cannot replace stored identities",
  ({ operations }) => {
    const allocate = vi.fn();
    expect(() => createWriterIdentityMap(before, allocate)(operations)).toThrow(
      "unique",
    );
    expect(allocate).not.toHaveBeenCalled();
  },
);

test("existing operations preserve their IDs and references", () => {
  const operations: DocumentOperation[] = [
    {
      data: { content: "Edited", type: "paragraph" },
      id: "existing",
      type: "update",
    },
  ];
  expect(createWriterIdentityMap(before)(operations)).toEqual(operations);
});
