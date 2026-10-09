import { expect, test } from "vitest";
import {
  addGraphOccurrence,
  createGraphSourceExcerpt,
  type GraphSourceExcerpt,
} from "../src/trpc/procedures/references";

const occurrence = {
  id: "00000000-0000-4000-8000-000000000001",
  presentation: "badge",
  source_block_id: "00000000-0000-4000-8000-000000000002",
  source_document_id: "00000000-0000-4000-8000-000000000003",
};

test("graph excerpts include only owner-authored blocks from the source note", () => {
  const sourceNote = { href: "https://journl.example/pages/source" };
  const block = {
    data: [
      {
        content: [{ text: "A useful detail", type: "text" }],
        type: "paragraph",
      },
      {
        content: [{ text: "secret code", type: "text" }],
        type: "codeBlock",
      },
    ],
    document_id: occurrence.source_document_id,
    user_id: "owner",
  };

  expect(
    createGraphSourceExcerpt(occurrence, block, sourceNote, "owner"),
  ).toEqual({
    blockId: occurrence.source_block_id,
    excerpt: "A useful detail",
    href: `${sourceNote.href}#block=${occurrence.source_block_id}`,
  });
  expect(
    createGraphSourceExcerpt(
      occurrence,
      { ...block, user_id: "another-user" },
      sourceNote,
      "owner",
    ),
  ).toBeUndefined();
  expect(
    createGraphSourceExcerpt(
      occurrence,
      { ...block, document_id: "another-document" },
      sourceNote,
      "owner",
    ),
  ).toBeUndefined();
});

test("graph edges expose stable occurrence IDs and deduplicate counts", () => {
  const excerpt: GraphSourceExcerpt = {
    blockId: occurrence.source_block_id,
    excerpt: "A useful detail",
    href: "https://journl.example/pages/source#block=00000000-0000-4000-8000-000000000002",
  };
  const edge = {
    occurrenceCount: 0,
    occurrenceIds: [] as string[],
    presentations: new Set<string>(),
    sourceBlocks: [] as string[],
    sources: [] as GraphSourceExcerpt[],
  };

  addGraphOccurrence(edge, occurrence, excerpt);
  addGraphOccurrence(edge, occurrence, excerpt);

  expect(edge.occurrenceIds).toEqual([occurrence.id]);
  expect(edge.occurrenceCount).toBe(1);
  expect(edge.sourceBlocks).toEqual([occurrence.source_block_id]);
  expect(edge.sources).toEqual([excerpt]);
  expect([...edge.presentations]).toEqual(["badge"]);
});
