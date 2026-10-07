// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { GraphExplorer } from "../src/app/(app)/graph/_components/graph-explorer";

beforeAll(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterAll(() => vi.unstubAllGlobals());

const graph = vi.hoisted(() => ({
  edges: [
    {
      fromKey: "a",
      occurrenceCount: 1,
      presentations: ["link"],
      sourceBlocks: ["block-a"],
      toKey: "b",
    },
    {
      fromKey: "a",
      occurrenceCount: 1,
      presentations: ["card"],
      sourceBlocks: ["block-c"],
      toKey: "external1",
    },
    {
      fromKey: "b",
      occurrenceCount: 1,
      presentations: ["link"],
      sourceBlocks: ["block-b"],
      toKey: "external2",
    },
  ],
  inputs: [] as Array<{ types: string[] }>,
  nodes: [
    {
      href: "https://journl.example/pages/a",
      key: "a",
      kind: "page",
      title: "First note",
    },
    {
      href: "https://journl.example/pages/b",
      key: "b",
      kind: "page",
      title: "Second note",
    },
    {
      href: "https://github.com/atomly/journl/issues/291",
      key: "external1",
      kind: "external",
      title: "github.com/atomly/journl/issues/291",
    },
    {
      href: "https://github.com/atomly/journl/pull/302",
      key: "external2",
      kind: "external",
      title: "github.com/atomly/journl/pull/302",
    },
  ],
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props} />
  ),
}));
vi.mock("../src/trpc/react", () => ({
  useTRPC: () => ({
    references: {
      getGraph: {
        queryOptions: (input: { types: string[] }) => {
          graph.inputs.push(input);
          return {
            queryFn: async () => {
              const nodes = graph.nodes.filter((node) =>
                input.types.includes(node.kind),
              );
              return {
                edges: graph.edges.filter(
                  (edge) =>
                    nodes.some((node) => node.key === edge.fromKey) &&
                    nodes.some((node) => node.key === edge.toKey),
                ),
                nextCursor: null,
                nodes,
                truncated: false,
              };
            },
            queryKey: ["graph", input],
          };
        },
      },
      listOccurrences: {
        queryOptions: () => ({
          queryFn: async () => ({ items: [] }),
          queryKey: ["occurrences"],
        }),
      },
    },
  }),
}));

test("graph focuses on notes and exposes selected connections with exact source links", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <GraphExplorer />
        </QueryClientProvider>,
      ),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(graph.inputs[0]?.types).toEqual(["page", "journal"]);
    const checkbox = container.querySelectorAll(
      "input[type=checkbox]",
    )[1] as HTMLInputElement;
    await act(async () => checkbox.click());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(container.textContent).toContain(
      "github.com/atomly/journl/issues/291",
    );
    expect(container.textContent).toContain(
      "github.com/atomly/journl/pull/302",
    );
    await act(async () =>
      (
        container.querySelector(
          'a[aria-label="Select First note"]',
        ) as SVGElement
      ).dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      ),
    );
    const connections = container.querySelector(
      '[aria-label="Graph connections and provenance"]',
    );
    expect(connections?.children).toHaveLength(2);
    expect(connections?.textContent).not.toContain("pull/302");
    expect(
      connections?.querySelector('a[href="/pages/a#block=block-a"]'),
    ).not.toBeNull();
    expect(
      connections?.querySelector('a[href="/pages/a#block=block-c"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('line[stroke-opacity="0.06"]'),
    ).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
  }
});
