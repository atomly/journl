// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { ReferenceBacklinks } from "../src/components/references/reference-backlinks";

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("../src/trpc/react", () => ({
  useTRPC: () => ({
    references: {
      listBacklinks: {
        queryOptions: (input: unknown) => ({
          queryFn: mocks.load,
          queryKey: ["backlinks", input],
        }),
      },
    },
  }),
}));
const cleanups: Array<() => void> = [];
afterEach(async () => {
  await act(async () => {
    for (const cleanup of cleanups.splice(0)) cleanup();
  });
  mocks.load.mockReset();
});
async function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanups.push(() => {
    root.unmount();
    container.remove();
    client.clear();
  });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <ReferenceBacklinks documentId="target" />
      </QueryClientProvider>,
    );
  });
  return { client, container };
}

test("backlinks load immediately while collapsed and no empty or loading section is shown", async () => {
  mocks.load.mockResolvedValue({ items: [] });
  const { container } = await setup();
  await vi.waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(1));
  expect(container.textContent).toBe("");
  expect(container.querySelector("section")).toBeNull();
});

test("nonempty backlinks show a collapsed count and open already-loaded source links", async () => {
  mocks.load.mockResolvedValue({
    items: [
      {
        documentId: "source",
        href: "/pages/source",
        occurrenceCount: 2,
        snippets: [
          {
            href: "/pages/source#block",
            snippet: "Linked passage",
            sourceBlockId: "block",
          },
        ],
        title: "Source note",
      },
    ],
  });
  const { container, client } = await setup();
  await vi.waitFor(() =>
    expect(container.textContent).toContain("Referenced by1"),
  );
  const toggle = container.querySelector("button");
  expect(toggle?.getAttribute("aria-expanded")).toBe("false");
  expect(container.textContent).not.toContain("Source note");
  await act(async () => toggle?.click());
  expect(container.textContent).toContain("Source note");
  expect(container.textContent).not.toContain("Loading references");
  expect(mocks.load).toHaveBeenCalledTimes(1);
  mocks.load.mockResolvedValue({ items: [] });
  await act(async () => {
    await client.invalidateQueries();
  });
  await vi.waitFor(() => expect(container.querySelector("section")).toBeNull());
});
