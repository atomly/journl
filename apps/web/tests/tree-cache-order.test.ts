import { QueryClient } from "@tanstack/react-query";
import { expect, test } from "vitest";
import {
  insertItem,
  moveNode,
  type TreeChildrenInfiniteData,
  type TreeItem,
} from "~/trpc/cache/tree-cache";

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

function fixture(hasMore = true) {
  const queryClient = new QueryClient();
  const queryKey = ["tree", "root"];
  queryClient.setQueryData<TreeChildrenInfiniteData>(queryKey, {
    pageParams: [undefined, "B"],
    pages: [
      { items: [item("A"), item("B")], nextCursor: "B" },
      { items: [item("C"), item("D")], nextCursor: hasMore ? "D" : undefined },
    ],
  });
  return {
    getContainerQueryKey: () => queryKey,
    queryClient,
    queryFilter: { queryKey },
    queryKey,
  };
}

test("moving a pagination boundary updates both cursors and page parameters", () => {
  const setup = fixture();
  moveNode({
    ...setup,
    destination: {
      anchor_edge_id: "D",
      parent_node_id: null,
      position: "after",
    },
    nodeId: "B",
  });
  const result = setup.queryClient.getQueryData<TreeChildrenInfiniteData>(
    setup.queryKey,
  );
  expect(
    result?.pages.flatMap((page) => page.items.map((value) => value.node_id)),
  ).toEqual(["A", "C", "D", "B"]);
  expect(result?.pageParams).toEqual([undefined, "A"]);
  expect(result?.pages.map((page) => page.nextCursor)).toEqual(["A", "B"]);
});

test("bottom placement appends when the entire list is loaded", () => {
  const setup = fixture(false);
  moveNode({
    ...setup,
    destination: { parent_node_id: null, position: "after" },
    nodeId: "A",
  });
  const result = setup.queryClient.getQueryData<TreeChildrenInfiniteData>(
    setup.queryKey,
  );
  expect(
    result?.pages.flatMap((page) => page.items.map((value) => value.node_id)),
  ).toEqual(["B", "C", "D", "A"]);
  expect(result?.pages.at(-1)?.nextCursor).toBeUndefined();
});

test("true-tail moves do not put an item ahead of unloaded siblings", () => {
  const setup = fixture();
  moveNode({
    ...setup,
    destination: { parent_node_id: null, position: "after" },
    nodeId: "D",
  });
  const result = setup.queryClient.getQueryData<TreeChildrenInfiniteData>(
    setup.queryKey,
  );
  expect(
    result?.pages.flatMap((page) => page.items.map((value) => value.node_id)),
  ).toEqual(["A", "B", "C"]);
  expect(result?.pages.at(-1)?.nextCursor).toBe("C");
});

test("an unloaded anchor does not incorrectly prepend an item", () => {
  const setup = fixture();
  insertItem({
    ...setup,
    anchorEdgeId: "unloaded",
    item: item("X"),
    position: "after",
  });
  expect(
    setup.queryClient.getQueryData<TreeChildrenInfiniteData>(setup.queryKey)
      ?.pages[0]?.items[0]?.node_id,
  ).toBe("A");
});

test("an anchored insertion defaults to before, matching server placement", () => {
  const setup = fixture();
  insertItem({ ...setup, anchorEdgeId: "C", item: item("X") });
  expect(
    setup.queryClient
      .getQueryData<TreeChildrenInfiniteData>(setup.queryKey)
      ?.pages.flatMap((page) => page.items.map((value) => value.node_id)),
  ).toEqual(["A", "B", "X", "C", "D"]);
});
