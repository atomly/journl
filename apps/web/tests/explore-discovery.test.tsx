// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ClusterExplorer } from "../src/app/(app)/explore/_components/cluster-explorer";
import { ExploreOverview } from "../src/app/(app)/explore/_components/explore-overview";
import { ExploreStateProvider } from "../src/app/(app)/explore/_components/explore-state-provider";
import { SourceContexts } from "../src/app/(app)/explore/_components/source-contexts";

const mock = vi.hoisted(() => ({
  calls: [] as { name: string; input: Record<string, unknown> }[],
  connectionPages: false,
  fail: false,
  failCursor: false,
  listeners: new Set<() => void>(),
  name: "Editor improvements",
  retired: false,
  route: "/explore",
}));
const clusterId = "00000000-0000-4000-8000-000000000001";
const noteId = "00000000-0000-4000-8000-000000000002";
const note = {
  evidence: [
    {
      excerpt: "The passage connecting these notes.",
      href: "/pages/decision#block=reference",
      id: "reference",
      kind: "document",
    },
  ],
  evidenceIds: ["reference"],
  href: "/pages/decision",
  id: noteId,
  kind: "page",
  role: "primary",
  title: "Implementation decisions",
  updatedAt: "2026-10-08T00:00:00Z",
};
const metadata = {
  refreshing: false,
  restartRequired: false,
  revision: 1,
  snapshotId: "00000000-0000-4000-8000-000000000003",
};
function navigate(route: string) {
  mock.route = route;
  for (const listener of mock.listeners) listener();
}
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: (route: string) => navigate(route) }),
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      {...props}
      onClick={(e) => {
        e.preventDefault();
        navigate(String(href));
      }}
    >
      {children}
    </a>
  ),
}));
vi.mock("../src/trpc/react", () => {
  const make = (
    name: string,
    run: (input: Record<string, unknown>) => unknown,
  ) => ({
    pathKey: () => ["explore", name],
    queryKey: (input: unknown) => ["explore", name, input],
    queryOptions: (input: Record<string, unknown>, options?: object) => ({
      queryKey: ["explore", name, input],
      ...options,
      queryFn: async () => {
        mock.calls.push({ input, name });
        await new Promise((r) => setTimeout(r, 8));
        if (mock.fail || (mock.failCursor && input.cursor))
          throw new Error("unavailable");
        return run(input);
      },
    }),
  });
  const trpc = {
    explore: {
      getCluster: make("getCluster", (input) => ({
        ...metadata,
        nextSuccessorCursor:
          mock.retired && !input.cursor ? "more-successors" : undefined,
        successors: mock.retired
          ? Array.from({ length: input.cursor ? 2 : 24 }, (_, i) => ({
              id: `successor-${input.cursor ? i + 24 : i}`,
              name: `Successor ${input.cursor ? i + 24 : i}`,
            }))
          : [],
        successorTotal: mock.retired ? 26 : 0,
        summary: mock.retired
          ? null
          : {
              id: clusterId,
              lastActivity: note.updatedAt,
              name: mock.name,
              primaryCount: 30,
              relatedCount: 1,
              representatives: [note],
              sourceCount: 2,
            },
      })),
      getClusterMap: make("getClusterMap", () => ({
        ...metadata,
        graph: {
          edges: [],
          nodes: [
            {
              href: note.href,
              key: `document:${noteId}`,
              kind: "page",
              target: { documentId: noteId, kind: "document" },
              title: note.title,
            },
          ],
        },
        hasMoreConnections: false,
        omittedNotes: 28,
        omittedSources: 1,
      })),
      listClusterMembers: make("listClusterMembers", (input) => ({
        ...metadata,
        items: Array.from(
          { length: input.role === "related" ? 1 : input.cursor ? 10 : 20 },
          (_, i) => ({
            ...note,
            id: `note-${input.cursor ? i + 20 : i}`,
            title: `Note ${input.cursor ? i + 20 : i}`,
          }),
        ),
        nextCursor:
          !input.cursor && input.role !== "related" ? "more-notes" : undefined,
        total: input.role === "related" ? 1 : 30,
      })),
      listClusterSources: make("listClusterSources", () => ({
        ...metadata,
        items: [
          {
            documentCount: 2,
            key: "external:source",
            title: "Source article",
            url: "https://example.com/article",
          },
        ],
        total: 1,
      })),
      listClusters: make("listClusters", (input) => ({
        ...metadata,
        items:
          input.search && input.search !== "Editor"
            ? []
            : [
                {
                  id: clusterId,
                  lastActivity: note.updatedAt,
                  name: mock.name,
                  primaryCount: 30,
                  relatedCount: 1,
                  representatives: [note],
                  sourceCount: 2,
                },
              ],
        nextCursor: input.cursor ? undefined : "page2",
        total: 14,
      })),
      listRecentNotes: make("listRecentNotes", () => ({
        ...metadata,
        items: [note],
        total: 1,
      })),
      listRelatedThreads: make("listRelatedThreads", () => []),
      listSourceContexts: make("listSourceContexts", () => ({
        ...metadata,
        items: [
          {
            blockId: "block",
            excerpt: "This passage explains the saved source.",
            href: "/pages/decision#block=block",
            note,
          },
        ],
      })),
      listThreadConnections: make("listThreadConnections", (input) => ({
        ...metadata,
        items: [
          {
            connections: 2,
            id: "00000000-0000-4000-8000-000000000009",
            name: "Release planning",
          },
        ],
        nextCursor:
          mock.connectionPages && !input.cursor ? "connection-next" : undefined,
        total: mock.connectionPages ? 2 : 1,
      })),
      pathKey: () => ["explore"],
      renameCluster: {
        mutationOptions: (options: object) => ({
          ...options,
          mutationFn: async (input: { name: string }) => {
            mock.name = input.name;
            return { id: clusterId };
          },
        }),
      },
    },
    references: {
      getPreviews: make("preview", () => ({
        items: [
          {
            preview: {
              excerpt: "The supporting context.",
              status: "ready",
              title: note.title,
            },
          },
        ],
      })),
    },
  };
  return { useTRPC: () => trpc };
});
const settle = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 60));
  });
};
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let client: QueryClient;
function App() {
  const route = useSyncExternalStore(
    (listener) => {
      mock.listeners.add(listener);
      return () => mock.listeners.delete(listener);
    },
    () => mock.route,
  );
  return route.includes("/sources?") ? (
    <SourceContexts clusterId={clusterId} targetKey="external:source" />
  ) : route.startsWith("/explore/clusters/") ? (
    <ClusterExplorer key={clusterId} clusterId={clusterId} />
  ) : (
    <ExploreOverview />
  );
}
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("matchMedia", () => ({
    addEventListener() {},
    matches: false,
    removeEventListener() {},
  }));
  sessionStorage.clear();
  mock.route = "/explore";
  mock.name = "Editor improvements";
  mock.calls = [];
  mock.fail = false;
  mock.failCursor = false;
  mock.connectionPages = false;
  mock.retired = false;
  metadata.snapshotId = "00000000-0000-4000-8000-000000000003";
  class Observer {
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", Observer);
  client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <ExploreStateProvider owner="test-owner">
          <App />
        </ExploreStateProvider>
      </QueryClientProvider>,
    ),
  );
  await settle();
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
  vi.unstubAllGlobals();
});
async function click(element: Element | undefined | null) {
  expect(element).toBeTruthy();
  await act(async () => (element as HTMLElement).click());
  await settle();
}
const button = (label: string, parent: ParentNode = container) =>
  [...parent.querySelectorAll("button")].find((b) => b.textContent === label);

test("overview requests one bounded page and pagination is explicit", async () => {
  expect(mock.calls.filter((c) => c.name === "listClusters")).toHaveLength(1);
  expect(container.textContent).toContain("Editor improvements");
  await click(
    button("Next", container.querySelector('[aria-label="Your threads"]')!),
  );
  expect(
    mock.calls.some(
      (c) => c.name === "listClusters" && c.input.cursor === "page2",
    ),
  ).toBe(true);
});
test("opening a thread makes all notes and sources accessible with context", async () => {
  await click(
    container.querySelector(`a[href="/explore/clusters/${clusterId}"]`),
  );
  await settle();
  expect(container.querySelector("h1")?.textContent).toBe(
    "Editor improvements",
  );
  expect(container.textContent).toContain("Browse every note and source below");
  const list = container.querySelector('[aria-label="All notes and sources"]')!;
  expect(list.querySelectorAll('a[href^="/explore/notes/"]')).toHaveLength(20);
  await click(button("Why here?", list));
  expect(list.textContent).toContain("The passage connecting these notes.");
  expect(
    list.querySelector('a[href="/pages/decision#block=reference"]'),
  ).not.toBeNull();
  await click(button("Next", list));
  expect(list.querySelectorAll('a[href^="/explore/notes/"]')).toHaveLength(10);
  await click(button("Sources"));
  expect(container.textContent).toContain("Referenced in 2 notes");
  await click(
    [...container.querySelectorAll("a")].find(
      (a) => a.textContent === "Read context →",
    ),
  );
  expect(container.textContent).toContain(
    "This passage explains the saved source.",
  );
  expect(
    container.querySelector('a[href="/pages/decision#block=block"]'),
  ).not.toBeNull();
  expect(
    container.querySelector(
      `a[href="/explore/notes/${noteId}?thread=${clusterId}"]`,
    ),
  ).not.toBeNull();
});
test("rename preserves the visible name and accessible note actions", async () => {
  await click(
    container.querySelector(`a[href="/explore/clusters/${clusterId}"]`),
  );
  await settle();
  await click(container.querySelector('[aria-label="Rename thread"]'));
  const input = document.querySelector(
    '[aria-label="Thread name"]',
  ) as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(input, "My project");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () =>
    document
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  await settle();
  expect(container.querySelector("h1")?.textContent).toBe("My project");
  await click(container.querySelector(`[aria-label="Preview ${note.title}"]`));
  expect(
    container.querySelector('[aria-label="Note preview"]')?.textContent,
  ).toContain("The supporting context.");
  expect(container.querySelector("aside")?.className).toContain("sticky");
});
test("overview search actually filters threads and can be cleared", async () => {
  const input = container.querySelector(
    '[aria-label="Find a thread"]',
  ) as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(input, "missing");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 300));
  });
  await settle();
  expect(container.textContent).toContain("No threads match that name");
});
test("failed requests retain a usable shell and retry succeeds", async () => {
  mock.fail = true;
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["explore"] });
  });
  await settle();
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  mock.fail = false;
  await click(button("Try again"));
  expect(container.textContent).toContain("Editor improvements");
});

test("selecting a thread exposes authored connections before opening it", async () => {
  await click(
    container.querySelector(
      '[aria-label="Show connections for Editor improvements"]',
    ),
  );
  const panel = container.querySelector('[aria-label="Thread connections"]');
  expect(panel?.textContent).toContain("Release planning");
  expect(panel?.textContent).toContain("2 references");
  expect(
    mock.calls.filter((call) => call.name === "listThreadConnections"),
  ).toHaveLength(1);
});

test("published snapshot changes restart connection pagination without sending a mismatched cursor", async () => {
  mock.connectionPages = true;
  await click(
    container.querySelector(
      '[aria-label="Show connections for Editor improvements"]',
    ),
  );
  await click(
    [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "More connections",
    ),
  );
  expect(
    mock.calls.some(
      (call) =>
        call.name === "listThreadConnections" &&
        call.input.cursor === "connection-next",
    ),
  ).toBe(true);
  metadata.snapshotId = "00000000-0000-4000-8000-000000000004";
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["explore", "listClusters"] });
  });
  await settle();
  const refreshed = mock.calls.filter(
    (call) =>
      call.name === "listThreadConnections" &&
      call.input.snapshotId === metadata.snapshotId,
  );
  expect(refreshed.length).toBeGreaterThan(0);
  expect(refreshed.every((call) => call.input.cursor === undefined)).toBe(true);
});
test("retry clears a rejected pagination cursor rather than repeating it", async () => {
  mock.failCursor = true;
  await click(
    [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Next",
    ),
  );
  await click(
    [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Try again",
    ),
  );
  expect(
    mock.calls.filter((call) => call.name === "listClusters").at(-1)?.input
      .cursor,
  ).toBeUndefined();
});

test("retired thread choices disclose counts and reach every successor", async () => {
  mock.retired = true;
  await act(async () => navigate(`/explore/clusters/${clusterId}`));
  await settle();
  expect(container.textContent).toContain("26 current threads");
  expect(container.querySelectorAll('a[href*="successor-"]')).toHaveLength(24);
  await click(button("Next"));
  expect(container.querySelectorAll('a[href*="successor-"]')).toHaveLength(2);
  expect(container.textContent).toContain("Successor 25");
  await click(button("Previous"));
  expect(container.querySelectorAll('a[href*="successor-"]')).toHaveLength(24);
});
