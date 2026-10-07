import { expect, test, vi } from "vitest";

const mock = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mock.redirect }));
vi.mock("../src/app/_guards/page-guards", () => ({
  withAuth: (component: unknown) => component,
}));

import LegacyGraphPage from "../src/app/(app)/graph/page";

test("legacy graph links redirect to Explore without dropping note, block or repeated parameters", async () => {
  await LegacyGraphPage({
    searchParams: Promise.resolve({
      blockId: "block-id",
      documentId: "note-id",
      filter: ["page", "journal"],
      unused: undefined,
    }),
  });
  const destination = new URL(
    mock.redirect.mock.calls.at(-1)?.[0],
    "https://journl.example",
  );
  expect(destination.pathname).toBe("/explore");
  expect(destination.searchParams.get("documentId")).toBe("note-id");
  expect(destination.searchParams.get("blockId")).toBe("block-id");
  expect(destination.searchParams.getAll("filter")).toEqual([
    "page",
    "journal",
  ]);
  expect(destination.searchParams.has("unused")).toBe(false);
});

test("legacy graph overview redirects to canonical Explore", async () => {
  await LegacyGraphPage({ searchParams: Promise.resolve({}) });
  expect(mock.redirect).toHaveBeenLastCalledWith("/explore");
});
