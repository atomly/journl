import { beforeEach, expect, test, vi } from "vitest";

const queries = vi.hoisted(() => ({
  journalBetween: vi.fn(),
  journalRelevant: vi.fn(),
  pageRelevant: vi.fn(),
}));
vi.mock("~/trpc/server", () => ({
  api: {
    journal: {
      getBetween: queries.journalBetween,
      getRelevantEntries: queries.journalRelevant,
    },
    pages: { getRelevantPages: queries.pageRelevant },
  },
}));

import { semanticJournalSearch } from "./semantic-journal-search";
import { semanticPageSearch } from "./semantic-page-search";
import { temporalJournalSearch } from "./temporal-journal-search";

beforeEach(() => vi.clearAllMocks());

test("note search returns same-deployment paths rather than production hostnames", async () => {
  queries.pageRelevant.mockResolvedValue([
    {
      chunk_markdown_text: "Text",
      document_id: "10000000-0000-4000-8000-000000000001",
      page_id: "page-one",
      page_title: "Title",
      similarity: 1,
    },
  ]);
  queries.journalRelevant.mockResolvedValue([
    {
      chunk_markdown_text: "Text",
      date: "2026-11-06",
      document_id: "10000000-0000-4000-8000-000000000001",
      similarity: 1,
    },
  ]);
  queries.journalBetween.mockResolvedValue([
    { blocks: null, date: "2026-11-06", id: "journal-one" },
  ]);
  const page = await semanticPageSearch.execute?.(
    {
      limit: 5,
      query: "recipe",
      threshold: 0.1,
    },
    {},
  );
  const journal = await semanticJournalSearch.execute?.(
    {
      limit: 5,
      query: "recipe",
      threshold: 0.1,
    },
    {},
  );
  const temporal = await temporalJournalSearch.execute?.(
    {
      from: "2026-11-06",
      to: "2026-11-06",
    },
    {},
  );
  expect(page).toEqual([expect.objectContaining({ link: "/pages/page-one" })]);
  expect(journal).toEqual([
    expect.objectContaining({ link: "/journal/2026-11-06" }),
  ]);
  expect(temporal).toEqual([
    expect.objectContaining({ link: "/journal/2026-11-06" }),
  ]);
  const preview = "https://journl-hu9hmbv85-atomly.vercel.app";
  if (!Array.isArray(page)) throw new Error("Expected page search results");
  expect(new URL(page[0]?.link ?? "", preview).origin).toBe(preview);
});
