// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { GraphExplorer } from "../src/app/(app)/graph/_components/graph-explorer";

const mock = vi.hoisted(() => ({
  inputs: [] as Array<{ seedDocumentId?: string; cursor?: string }>,
  listeners: new Set<() => void>(),
  location: "",
  pushes: [] as string[],
}));
const nodes = [
  {
    href: "https://journl.example/pages/a",
    key: "document:a",
    kind: "page",
    target: { documentId: "a", kind: "document" },
    title: "Editor improvements",
  },
  {
    href: "https://journl.example/journal/2026-10-07",
    key: "document:b",
    kind: "journal",
    target: { documentId: "b", kind: "document" },
    title: "Testing feedback",
  },
  {
    href: "https://journl.example/pages/c",
    key: "document:c",
    kind: "page",
    target: { documentId: "c", kind: "document" },
    title: "Implementation decisions",
  },
  {
    href: "https://journl.example/pages/d",
    key: "document:d",
    kind: "page",
    target: { documentId: "d", kind: "document" },
    title: "A separate thought",
  },
  {
    href: "https://github.com/atomly/journl/pull/302",
    key: "external",
    kind: "external",
    title: "github.com/atomly/journl/pull/302",
  },
];
const edge = (from: string, to: string) => ({
  fromKey: `document:${from}`,
  occurrenceCount: 1,
  occurrenceIds: [`${from}:${to}`],
  presentations: ["link"],
  sourceBlocks: [`block-${from}`],
  sources: [
    {
      blockId: `block-${from}`,
      excerpt:
        from === "a"
          ? "The heading menu closes while choosing a text type."
          : "Check the implementation and record the decision.",
      href: `https://journl.example/pages/${from}#block=block-${from}`,
    },
  ],
  toKey: to === "external" ? to : `document:${to}`,
});
const edges = [edge("a", "b"), edge("b", "c"), edge("b", "external")];

vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useRouter: () => ({
      push: (href: string) => {
        mock.pushes.push(href);
        if (!href.startsWith("/graph")) return;
        mock.location = href.split("?")[1] ?? "";
        for (const listener of mock.listeners) listener();
      },
    }),
    useSearchParams: () => {
      useSyncExternalStore(
        (listener) => {
          mock.listeners.add(listener);
          return () => mock.listeners.delete(listener);
        },
        () => mock.location,
      );
      return new URLSearchParams(mock.location);
    },
  };
});
vi.mock("next/link", () => ({
  default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props} />
  ),
}));
vi.mock("../src/trpc/react", () => ({
  useTRPC: () => ({
    references: {
      getGraph: {
        infiniteQueryOptions: (
          input: { seedDocumentId?: string },
          options: unknown,
        ) => ({
          initialPageParam: undefined,
          queryKey: ["graph", input],
          ...(options as object),
          queryFn: async ({ pageParam }: { pageParam?: string }) => {
            mock.inputs.push({ ...input, cursor: pageParam });
            if (input.seedDocumentId) {
              const selectedEdges = edges.filter(
                (edge) =>
                  edge.fromKey === `document:${input.seedDocumentId}` ||
                  edge.toKey === `document:${input.seedDocumentId}`,
              );
              const keys = new Set(
                selectedEdges.flatMap((edge) => [edge.fromKey, edge.toKey]),
              );
              keys.add(`document:${input.seedDocumentId}`);
              return {
                edges: selectedEdges,
                nextCursor: null,
                nodes: nodes.filter((node) => keys.has(node.key)),
                truncated: false,
              };
            }
            return pageParam
              ? { edges, nextCursor: null, nodes, truncated: false }
              : {
                  edges: edges.slice(0, 1),
                  nextCursor: "next",
                  nodes: nodes.slice(0, 2),
                  truncated: true,
                };
          },
        }),
      },
      getPreviews: {
        queryOptions: (
          input: { targets: Array<{ documentId: string }> },
          options: unknown,
        ) => ({
          queryKey: ["preview", input],
          ...(options as object),
          queryFn: async () => ({
            items: input.targets.map((target) => ({
              preview: {
                excerpt: "The latest context from this note.",
                status: "ready",
                title: nodes.find(
                  (node) => node.target?.documentId === target.documentId,
                )?.title,
              },
              target,
            })),
          }),
        }),
      },
      searchTargets: {
        queryOptions: (input: { query: string }, options: unknown) => ({
          queryKey: ["search", input],
          ...(options as object),
          queryFn: async () => ({
            items: nodes
              .filter(
                (node) =>
                  node.target &&
                  node.title.toLowerCase().includes(input.query.toLowerCase()),
              )
              .map((node) => ({
                documentId: node.target?.documentId,
                href: node.href,
                kind: node.kind,
                title: node.title,
              })),
            nextCursor: null,
          }),
        }),
      },
    },
  }),
}));

beforeAll(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      addEventListener() {},
      matches: false,
      removeEventListener() {},
    })),
  );
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  mock.location = "";
  mock.inputs.length = 0;
  mock.pushes.length = 0;
});
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
async function setup() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <GraphExplorer />
      </QueryClientProvider>,
    ),
  );
  await settle();
  await settle();
  return {
    cleanup: async () => {
      await act(async () => root.unmount());
      client.clear();
      container.remove();
    },
    container,
  };
}
const click = async (element: Element | null) => {
  expect(element).not.toBeNull();
  await act(async () => (element as HTMLElement).click());
  await settle();
};

test("automatically merges pages into one clustered canvas and separates unlinked notes", async () => {
  const { container, cleanup } = await setup();
  try {
    expect(mock.inputs.some((input) => input.cursor === "next")).toBe(true);
    expect(container.textContent).not.toContain("Next graph view");
    expect(container.querySelectorAll("input[type=checkbox]")).toHaveLength(0);
    const unlinked = container.querySelector('[aria-label="Unlinked notes"]');
    expect(unlinked?.textContent).toContain("A separate thought");
    expect(unlinked?.textContent).not.toContain("Editor improvements");
    expect(
      container.querySelector(
        'svg button[aria-label="Preview A separate thought"]',
      ),
    ).toBeNull();
    expect(
      container.querySelector(
        'svg button[aria-label="Preview github.com/atomly/journl/pull/302"]',
      ),
    ).toBeNull();
    await click(
      container.querySelector('[aria-label="Preview Testing feedback"]'),
    );
    const preview = container.querySelector('[aria-label="Note preview"]');
    expect(preview?.textContent).toContain(
      "The latest context from this note.",
    );
    expect(preview?.textContent).toContain(
      "The heading menu closes while choosing a text type.",
    );
    expect(preview?.textContent).toContain("Referenced here");
    expect(preview?.textContent).toContain("Links back here");
    expect(preview?.textContent).toContain("Linked sources");
    expect(
      preview?.querySelector('a[href="/pages/a#block=block-a"]'),
    ).not.toBeNull();
  } finally {
    await cleanup();
  }
});

test("exploring a note keeps a breadcrumb and restores selection and zoom on Back", async () => {
  const { container, cleanup } = await setup();
  try {
    await click(
      container.querySelector('[aria-label="Preview Testing feedback"]'),
    );
    await click(container.querySelector('[aria-label="Zoom in"]'));
    const canvasViewport = container.querySelector(
      '[aria-label="Explore connected notes"] > div:last-child',
    ) as HTMLDivElement;
    canvasViewport.scrollTop = 180;
    await act(async () => canvasViewport.dispatchEvent(new Event("scroll")));
    const preview = container.querySelector('[aria-label="Note preview"]');
    await click(
      [...(preview?.querySelectorAll("button") ?? [])].find(
        (button) => button.textContent === "Explore connections",
      ) ?? null,
    );
    expect(mock.location).toBe("documentId=b");
    expect(container.querySelector("h1")?.textContent).toBe("Testing feedback");
    expect(
      container.querySelector('[aria-label="Exploration trail"]')?.textContent,
    ).toContain("Explore");
    await click(
      container.querySelector('[aria-label="Back to previous exploration"]'),
    );
    expect(mock.location).toBe("");
    expect(
      (
        container.querySelector(
          '[aria-label="Explore connected notes"] > div:last-child',
        ) as HTMLDivElement
      ).scrollTop,
    ).toBe(180);
    expect(
      container.querySelector('[aria-label="Note preview"]')?.textContent,
    ).toContain("Testing feedback");
    expect(
      container.querySelector("svg > g")?.getAttribute("transform"),
    ).toContain("scale(1.25)");
    await click(
      [
        ...container.querySelectorAll(
          'section[aria-label="Note preview"] button',
        ),
      ].find((button) => button.textContent?.includes("Open note")) ?? null,
    );
    expect(mock.pushes.at(-1)).toBe("/journal/2026-10-07");
  } finally {
    await cleanup();
  }
});

test("a note without internal links stays available to preview and open", async () => {
  mock.location = "documentId=d";
  const { container, cleanup } = await setup();
  try {
    expect(container.querySelector("h1")?.textContent).toBe(
      "A separate thought",
    );
    expect(container.textContent).toContain("0 connected notes");
    await click(
      container.querySelector('[aria-label="Preview A separate thought"]'),
    );
    expect(
      container.querySelector('[aria-label="Note preview"]')?.textContent,
    ).toContain("No saved connections yet");
  } finally {
    await cleanup();
  }
});

test("mobile selections open a dismissible preview sheet with the source passages", async () => {
  const previousWidth = window.innerWidth;
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 393,
  });
  const { container, cleanup } = await setup();
  try {
    await click(
      container.querySelector('[aria-label="Preview Testing feedback"]'),
    );
    const sheet = document.querySelector('[data-slot="sheet-content"]');
    expect(sheet?.textContent).toContain(
      "The heading menu closes while choosing a text type.",
    );
    await click(
      sheet?.querySelector('[aria-label="Close note preview"]') ?? null,
    );
    expect(document.querySelector('[data-slot="sheet-content"]')).toBeNull();
  } finally {
    await cleanup();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: previousWidth,
    });
  }
});

test("search finds a starting note across the library and opens its connections", async () => {
  const { container, cleanup } = await setup();
  try {
    await act(async () =>
      container.querySelector<HTMLInputElement>("#explore-search")?.focus(),
    );
    await settle();
    const result = [...container.querySelectorAll("[data-search-result]")].find(
      (button) => button.textContent?.includes("Implementation decisions"),
    );
    await click(result ?? null);
    expect(mock.location).toBe("documentId=c");
    expect(container.querySelector("h1")?.textContent).toBe(
      "Implementation decisions",
    );
  } finally {
    await cleanup();
  }
});
