import { applyDocumentOperations, type DocumentBlock } from "@acme/document";
import { expect, test } from "vitest";
import {
  acceptedDocumentChange,
  documentSaveTransactions,
} from "./document-save-adapter";

test("surviving children move before a deleted ancestor cascades", () => {
  const before: DocumentBlock[] = [
    {
      children: [{ id: "child", type: "paragraph" }],
      id: "parent",
      type: "paragraph",
    },
  ];
  const operations = [
    { afterId: null, id: "child", parentId: null, type: "move" as const },
    { id: "parent", type: "remove" as const },
  ];
  const after = applyDocumentOperations(before, operations);
  const result = acceptedDocumentChange(before, after, operations);
  expect(result.transactions).toEqual([
    expect.objectContaining({
      args: expect.objectContaining({ id: "child", parent_id: null }),
      type: "block_upsert",
    }),
    { args: { id: "parent" }, type: "block_remove" },
  ]);
  expect(documentSaveTransactions(after, after)).toEqual([]);
});

test("a proposal cannot commit a different document than its validated operations", () => {
  expect(() =>
    acceptedDocumentChange([], [{ id: "unexplained", type: "paragraph" }], []),
  ).toThrow("do not match");
});
