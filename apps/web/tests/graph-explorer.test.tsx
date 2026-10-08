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
const baseNodes = [
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
    updatedAt: "2026-10-07T12:00:00Z",
  },
  {
    href: "https://github.com/atomly/journl/pull/302",
    key: "external",
    kind: "external",
    title: "github.com/atomly/journl/pull/302",
  },
];
let nodes = [...baseNodes];
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
        if (!href.startsWith("/explore")) return;
        const note = /^\/explore\/notes\/([^?]+)/.exec(href);
        mock.location = note
          ? `documentId=${note[1]}`
          : (href.split("?")[1] ?? "");
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
    explore: {
      memberships: {
        queryOptions: (input: unknown) => ({
          queryFn: async () => [],
          queryKey: ["memberships", input],
        }),
      },
    },
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
  sessionStorage.clear();
  mock.location = "";
  nodes = [...baseNodes];
  mock.inputs.length = 0;
  mock.pushes.length = 0;
});
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
async function setup(loadRemaining = true) {
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
  if (loadRemaining) {
    const load = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "Load more connections",
    );
    if (load) {
      await act(async () => load.click());
      await settle();
    }
  }
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

test("loads further connections only on request and merges them without losing context", async () => {
  const { container, cleanup } = await setup(false);
  try {
    expect(mock.inputs.some((input) => input.cursor === "next")).toBe(false);
    await click(
      [...container.querySelectorAll("button")].find(
        (b) => b.textContent === "Load more connections",
      ) ?? null,
    );
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
    ).not.toBeNull();
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
    expect(container.querySelector("h1")?.textContent).toBe(
      "Connections for Testing feedback",
    );
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
      "Connections for A separate thought",
    );
    expect(container.textContent).toContain("0 connections");
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
    expect(sheet?.className).toContain("data-[side=bottom]:h-[78dvh]");
    expect(sheet?.querySelector(".overscroll-contain")).not.toBeNull();
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

test("Explore uses the app search and keeps desktop context beside the canvas", async () => {
  const { container, cleanup } = await setup();
  try {
    expect(container.querySelector("#explore-search")).toBeNull();
    const context = container.querySelector(
      '[aria-label="Connection context"]',
    );
    expect(context?.className).toContain("sticky");
    expect(context?.className).toContain("self-start");
    await click(
      container.querySelector('[aria-label="Preview Testing feedback"]'),
    );
    await click(
      [
        ...container.querySelectorAll('[aria-label="Note preview"] button'),
      ].find((button) => button.textContent === "Explore connections") ?? null,
    );
    expect(mock.pushes.at(-1)).toBe("/explore/notes/b");
  } finally {
    await cleanup();
  }
});

test("unlinked discovery is newest first, bounded by page, and offers direct exploration", async () => {
  for (let index = 1; index <= 13; index += 1)
    nodes.push({
      href: `https://journl.example/pages/unlinked-${index}`,
      key: `document:unlinked-${index}`,
      kind: "page",
      target: { documentId: `unlinked-${index}`, kind: "document" },
      title: index === 13 ? "Z newest note" : `A older note ${index}`,
      updatedAt: `2026-10-${String(index).padStart(2, "0")}T12:00:00Z`,
    });
  const { container, cleanup } = await setup();
  try {
    const section = container.querySelector('[aria-label="Unlinked notes"]');
    expect(section?.querySelectorAll("li")).toHaveLength(12);
    expect(section?.querySelector("li")?.textContent).toContain(
      "Z newest note",
    );
    expect(section?.textContent).toContain("Updated");
    expect(section?.textContent).toContain("1–12 of 14 notes");
    await click(
      [...(section?.querySelectorAll("button") ?? [])].find(
        (button) => button.textContent === "Next",
      ) ?? null,
    );
    expect(section?.querySelectorAll("li")).toHaveLength(2);
    expect(section?.textContent).toContain("13–14 of 14 notes");
    await click(
      [...(section?.querySelectorAll("button") ?? [])].find(
        (button) => button.textContent === "Previous",
      ) ?? null,
    );
    await click(
      section?.querySelector('[aria-label="Sort unlinked notes"]') ?? null,
    );
    await click(
      [...document.querySelectorAll('[role="option"]')].find(
        (option) => option.textContent === "Oldest first",
      ) ?? null,
    );
    expect(section?.querySelector("li")?.textContent).toContain(
      "A older note 1",
    );
    expect(section?.textContent).toContain("1–12 of 14 notes");
    await click(
      section?.querySelector('[aria-label="Sort unlinked notes"]') ?? null,
    );
    await click(
      [...document.querySelectorAll('[role="option"]')].find(
        (option) => option.textContent === "Latest first",
      ) ?? null,
    );
    await click(
      section?.querySelector(
        '[aria-label="Explore connections for Z newest note"]',
      ) ?? null,
    );
    expect(mock.pushes.at(-1)).toBe("/explore/notes/unlinked-13");
  } finally {
    await cleanup();
  }
});
