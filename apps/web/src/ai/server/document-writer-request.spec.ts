import { expect, test } from "vitest";
import {
  InvalidDocumentWriterRequest,
  parseDocumentWriterRequest,
} from "./document-writer-request";

const input = {
  blocks: [{ content: "Unsaved writing", id: "a", type: "paragraph" }],
  instruction: "Improve the phrasing",
  targetEditor: "page:00000000-0000-4000-8000-000000000001",
};

test("writer snapshot keeps stable identities and unsaved content", () => {
  expect(parseDocumentWriterRequest(input)).toMatchObject(input);
  expect(
    parseDocumentWriterRequest({
      ...input,
      blocks: [],
      targetEditor: "journal-entry:2026-11-05",
    }),
  ).toMatchObject({ blocks: [] });
});

test.each([
  null,
  { ...input, instruction: " " },
  { ...input, targetEditor: "page:not-a-uuid" },
  { ...input, targetEditor: "journal-entry:2026-02-30" },
  { ...input, blocks: [...input.blocks, ...input.blocks] },
  { ...input, blocks: [{ ...input.blocks[0], children: input.blocks }] },
  { ...input, tools: { execute: "untrusted" } },
  { ...input, userId: "another-owner" },
  { ...input, reasoningEffort: "unbounded" },
])("rejects malformed or ambiguous writer requests", (body) => {
  expect(() => parseDocumentWriterRequest(body)).toThrow(
    InvalidDocumentWriterRequest,
  );
});
