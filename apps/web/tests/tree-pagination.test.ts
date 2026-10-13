import { expect, test } from "vitest";
import { paginateOrderedEdges } from "~/trpc/procedures/tree-helpers";

const edges = ["a", "b", "c", "d"].map((id) => ({ id }));

test("unchanged pagination returns every sibling once", () => {
  const first = paginateOrderedEdges(edges, undefined, 2);
  const second = paginateOrderedEdges(edges, first.nextCursor, 2);
  expect(second.resetRequired).toBe(false);
  expect([...first.edges, ...second.edges]).toEqual(edges);
  expect(second.nextCursor).toBeUndefined();
});

test("a cursor moved to the tail restarts rather than silently skipping siblings", () => {
  const first = paginateOrderedEdges(edges, undefined, 2);
  const reordered = ["a", "c", "d", "b"].map((id) => ({ id }));
  const second = paginateOrderedEdges(reordered, first.nextCursor, 2);
  expect(second.resetRequired).toBe(true);
  expect(second.edges).toEqual(reordered.slice(0, 2));
});

test("deleted cursors explicitly request replacement of loaded pages", () => {
  const first = paginateOrderedEdges(edges, undefined, 2);
  const remaining = edges.filter((edge) => edge.id !== "b");
  expect(paginateOrderedEdges(remaining, first.nextCursor, 2)).toMatchObject({
    edges: remaining.slice(0, 2),
    resetRequired: true,
  });
  expect(paginateOrderedEdges([], first.nextCursor, 2)).toMatchObject({
    edges: [],
    resetRequired: true,
  });
});

test("legacy edge cursors still work and upgrade to revision cursors", () => {
  const page = paginateOrderedEdges(edges, "a", 2);
  expect(page.resetRequired).toBe(false);
  expect(page.edges).toEqual(edges.slice(1, 3));
  expect(page.nextCursor).toMatch(/^c\|[a-f0-9]{64}$/);
});

test("a sibling insertion before the cursor invalidates its revision", () => {
  const first = paginateOrderedEdges(edges, undefined, 2);
  expect(
    paginateOrderedEdges([{ id: "new" }, ...edges], first.nextCursor, 2)
      .resetRequired,
  ).toBe(true);
});
