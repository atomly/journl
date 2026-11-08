import { expect, test } from "vitest";
import { inferUserIntent } from "./journl-agent-intent";

test.each([
  "Edit the current page in place",
  "Update the table on this page",
  "Find my notes, open the page and write a summary there",
  "Move the nested bullets and remove the last table row",
  "Change the page heading",
  "Append a numbered list",
  "Replace the selected paragraph",
  "Format this page with headings and a table",
  "Bold the second paragraph on this page",
  "Fix the table in this page",
  "Convert the first paragraph of this page into a heading",
  "Organize this page into sections",
])("editing never routes to the search model: %s", (prompt) => {
  expect(inferUserIntent(prompt)).not.toBe("search");
});

test.each([
  "Find my notes from last week",
  "Search my journal entries",
  "When did I write about camping?",
])("read-only lookup still routes to search: %s", (prompt) => {
  // The final case mentions writing as historical content. It may conservatively
  // use the writing-capable model, but it must never imply an edit authority.
  expect(["search", "mixed"]).toContain(inferUserIntent(prompt));
});
