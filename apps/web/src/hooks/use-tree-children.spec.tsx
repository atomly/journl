// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { useTreeChildren } from "./use-tree-children";

const fixture = vi.hoisted(() => ({
  async fetch(parent: string | null) {
    fixture.requests.push(parent);
    await new Promise((resolve) => setTimeout(resolve, 20));
    return { items: [], nextCursor: "next" };
  },
  requests: [] as (string | null)[],
}));
vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    tree: {
      getChildrenPaginated: {
        infiniteQueryOptions: (
          input: { parent_node_id: string | null },
          options: object,
        ) => ({
          initialPageParam: undefined,
          queryFn: () => fixture.fetch(input.parent_node_id),
          queryKey: ["children", input.parent_node_id],
          ...options,
        }),
      },
    },
  }),
}));

test("cold reads and return navigation reuse fresh first pages; collapsed folders never paginate", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const observed: IntersectionObserverCallback[] = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        observed.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
  fixture.requests = [];
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });
  const container = document.createElement("div");
  const root = createRoot(container);
  function Harness({ enabled }: { enabled: boolean }) {
    const query = useTreeChildren({ enabled, parentNodeId: "folder" });
    return (
      <div ref={query.loadMoreRef}>
        {query.shouldShowInitialSkeleton ? "loading" : "ready"}
      </div>
    );
  }
  const render = async (enabled: boolean, key: string) => {
    await act(() =>
      root.render(
        <QueryClientProvider client={client}>
          <Harness key={key} enabled={enabled} />
        </QueryClientProvider>,
      ),
    );
    for (let i = 0; container.textContent === "loading" && i < 100; i++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });
    }
    expect(container.textContent).toBe("ready");
  };
  try {
    const cold = performance.now();
    await render(true, "first");
    const coldMs = performance.now() - cold;
    expect(fixture.requests).toEqual(["folder"]);
    const returned = performance.now();
    await render(true, "return");
    expect(fixture.requests).toHaveLength(1);
    console.info(
      JSON.stringify({
        coldMs: Math.round(coldMs),
        coldRequests: 1,
        returnMs: Math.round(performance.now() - returned),
        returnRequests: 0,
        simulatedLatencyMs: 20,
      }),
    );
    await render(false, "closed");
    const observersBefore = observed.length;
    await render(false, "closed-again");
    expect(observed).toHaveLength(observersBefore);
    expect(fixture.requests).toHaveLength(1);
  } finally {
    await act(() => root.unmount());
    client.clear();
    vi.unstubAllGlobals();
  }
});

test("prefetching just the three active ancestors removes the nested reveal waterfall", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const measurements: {
    mode: string;
    requests: number;
    milliseconds: number;
  }[] = [];
  function Nested({ depth = 1 }: { depth?: number }) {
    const query = useTreeChildren({ parentNodeId: `folder-${depth}` });
    return query.shouldShowInitialSkeleton ? (
      "loading"
    ) : depth < 3 ? (
      <Nested depth={depth + 1} />
    ) : (
      "ready"
    );
  }
  try {
    for (const prefetch of [false, true]) {
      fixture.requests = [];
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
      });
      const container = document.createElement("div");
      const root = createRoot(container);
      const started = performance.now();
      if (prefetch)
        await Promise.all(
          [1, 2, 3].map((depth) =>
            client.prefetchInfiniteQuery({
              getNextPageParam: () => undefined,
              initialPageParam: undefined,
              pages: 1,
              queryFn: () => fixture.fetch(`folder-${depth}`),
              queryKey: ["children", `folder-${depth}`],
              staleTime: 30_000,
            }),
          ),
        );
      await act(() =>
        root.render(
          <QueryClientProvider client={client}>
            <Nested />
          </QueryClientProvider>,
        ),
      );
      for (let i = 0; container.textContent !== "ready" && i < 100; i++)
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
        });
      expect(container.textContent).toBe("ready");
      expect(fixture.requests).toHaveLength(3);
      measurements.push({
        milliseconds: Math.round(performance.now() - started),
        mode: prefetch ? "active-path-prefetch" : "cold-waterfall",
        requests: fixture.requests.length,
      });
      await act(() => root.unmount());
      client.clear();
    }
    console.info(JSON.stringify({ measurements, simulatedLatencyMs: 20 }));
  } finally {
    vi.unstubAllGlobals();
  }
});
