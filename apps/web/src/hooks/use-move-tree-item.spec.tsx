// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useMoveTreeItem } from "~/hooks/use-move-tree-item";
import { useTreeChildren } from "~/hooks/use-tree-children";
import type {
  TreeChildrenInfiniteData,
  TreeItem,
} from "~/trpc/cache/tree-cache";

const fixture = vi.hoisted(() => ({
  fetch: vi.fn(),
  move: vi.fn(),
  toast: vi.fn(),
}));
const key = [["tree", "getChildrenPaginated"]];
vi.mock("sonner", () => ({ toast: { error: fixture.toast } }));
vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    folders: { pathKey: () => [["folders"]] },
    pages: { getById: { pathKey: () => [["pages", "getById"]] } },
    tree: {
      getChildrenPaginated: {
        infiniteQueryFilter: () => ({
          queryKey: [["tree", "getChildrenPaginated"]],
        }),
        infiniteQueryKey: () => [["tree", "getChildrenPaginated"]],
        infiniteQueryOptions: (_input: unknown, options: object) => ({
          ...options,
          initialPageParam: null,
          queryFn: ({ pageParam }: { pageParam: string | null }) =>
            fixture.fetch(pageParam),
          queryKey: [["tree", "getChildrenPaginated"]],
        }),
      },
      moveItem: {
        mutationKey: () => [["tree", "moveItem"]],
        mutationOptions: (options: object) => ({
          ...options,
          mutationFn: fixture.move,
          mutationKey: [["tree", "moveItem"]],
        }),
      },
      pathKey: () => [["tree"]],
    },
  }),
}));

function item(id: string): TreeItem {
  return {
    edge_id: id,
    kind: "page",
    node_id: id,
    page: {
      created_at: "2026-01-01",
      document_id: id,
      edge_id: id,
      id,
      node_id: id,
      parent_node_id: null,
      title: id,
      updated_at: "2026-01-01",
      user_id: "owner",
    },
    parent_node_id: null,
  };
}
function page(ids: string[], nextCursor?: string, resetRequired = false) {
  return { items: ids.map(item), nextCursor, resetRequired };
}
let client: QueryClient;
let root: Root;
let container: HTMLDivElement;
let moves: [
  ReturnType<typeof useMoveTreeItem>,
  ReturnType<typeof useMoveTreeItem>,
];
let children: ReturnType<typeof useTreeChildren>;
function Harness() {
  moves = [useMoveTreeItem(), useMoveTreeItem()];
  children = useTreeChildren({ parentNodeId: null });
  return <div>{children.items.map((entry) => entry.node_id).join(",")}</div>;
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  fixture.move.mockReset();
  fixture.fetch.mockReset();
  fixture.toast.mockReset();
  client = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
    },
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
  vi.unstubAllGlobals();
});
async function mount(data: TreeChildrenInfiniteData) {
  client.setQueryData(key, data);
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>,
    ),
  );
}
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

test("a failed move reconciles without erasing a later successful create", async () => {
  let reject!: (error: Error) => void;
  fixture.move.mockImplementation(
    () =>
      new Promise((_resolve, rejectMove) => {
        reject = rejectMove;
      }),
  );
  fixture.fetch.mockResolvedValue(page(["A", "B", "new-page"]));
  await mount({ pageParams: [null], pages: [page(["A", "B"])] });
  let result!: Promise<unknown>;
  await act(async () => {
    result = moves[0]
      .mutateAsync({
        destination: { parent_node_id: null, position: "after" },
        node_id: "A",
      })
      .catch(() => undefined);
  });
  await flush();
  expect(moves[1].isPending).toBe(true);
  // Another operation has already committed and patched the shared cache.
  client.setQueryData(key, {
    pageParams: [null],
    pages: [page(["B", "A", "new-page"])],
  });
  await act(async () => {
    reject(new Error("save failed"));
    await result;
  });
  await flush();
  expect(children.items.map((entry) => entry.node_id)).toEqual([
    "A",
    "B",
    "new-page",
  ]);
  expect(fixture.toast).toHaveBeenCalledOnce();
  expect(moves[1].isPending).toBe(false);
});

test("both views serialize their move saves", async () => {
  let finish!: () => void;
  fixture.move
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(undefined);
  fixture.fetch.mockResolvedValue(page(["B", "A"]));
  await mount({ pageParams: [null], pages: [page(["A", "B"])] });
  let first!: Promise<unknown>;
  let second!: Promise<unknown>;
  await act(async () => {
    first = moves[0].mutateAsync({
      destination: { parent_node_id: null, position: "after" },
      node_id: "A",
    });
    second = moves[1].mutateAsync({
      destination: { parent_node_id: null, position: "before" },
      node_id: "B",
    });
  });
  expect(fixture.move).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish();
    await Promise.all([first, second]);
  });
  expect(fixture.move).toHaveBeenCalledTimes(2);
});

test("a stale continuation replaces old pages and resumes from the fresh cursor", async () => {
  await mount({
    pageParams: [null, "B|old"],
    pages: [page(["A", "B"], "B|old"), page(["C", "A"], "A|new", true)],
  });
  await flush();
  expect(children.items.map((entry) => entry.node_id)).toEqual(["C", "A"]);
  expect(
    client.getQueryData<TreeChildrenInfiniteData>(key)?.pageParams,
  ).toEqual([null]);
  expect(client.getQueryData<TreeChildrenInfiniteData>(key)?.pages).toEqual([
    page(["C", "A"], "A|new"),
  ]);
});

test("a reset during a multi-page refetch retains one parameter per fresh page", async () => {
  await mount({
    pageParams: [null, "B|old", "A|new"],
    pages: [
      page(["A", "B"], "B|old"),
      page(["C", "A"], "A|new", true),
      page(["D", "E"]),
    ],
  });
  await flush();
  expect(children.items.map((entry) => entry.node_id)).toEqual([
    "C",
    "A",
    "D",
    "E",
  ]);
  expect(
    client.getQueryData<TreeChildrenInfiniteData>(key)?.pageParams,
  ).toEqual([null, "A|new"]);
});
