import type { CollisionDetection } from "@dnd-kit/core";
import { expect, test, vi } from "vitest";
import { createTreeCollisionDetection } from "~/lib/tree-dnd";

function args(pointer = true): Parameters<CollisionDetection>[0] {
  return {
    active: {
      data: {
        current: { edgeId: "source-edge", item: { nodeId: "source-node" } },
      },
      id: "source-node",
      rect: { current: { initial: null, translated: null } },
    },
    collisionRect: {
      bottom: 100,
      height: 100,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
    },
    droppableContainers: [],
    droppableRects: new Map(),
    pointerCoordinates: pointer ? { x: 50, y: 50 } : null,
  };
}

test("pointer drops do not fall back to intersecting rectangles outside the tree", () => {
  const detectByPointer = vi.fn(() => []);
  const detectByRect = vi.fn(() => [{ id: "drop:after:root:other-edge" }]);
  const detect = createTreeCollisionDetection({
    detectByPointer,
    detectByRect,
  });
  expect(detect(args())).toEqual([]);
  expect(detectByRect).not.toHaveBeenCalled();
});

test("a source's reorder bands and folder interior cannot be its own destination", () => {
  const detect = createTreeCollisionDetection({
    detectByPointer: () => [
      { id: "drop:before:root:source-edge" },
      { id: "drop:after:root:source-edge" },
      { id: "drop:inside:source-node" },
      { id: "drop:after:root:other-edge" },
      { id: "drop:inside:other-folder" },
    ],
  });
  expect(detect(args())).toEqual([
    { id: "drop:inside:other-folder" },
    { id: "drop:after:root:other-edge" },
  ]);
});

test("non-pointer dragging can still use rectangle intersections", () => {
  const detectByPointer = vi.fn(() => []);
  const detectByRect = vi.fn(() => [{ id: "drop:after:root:other-edge" }]);
  const detect = createTreeCollisionDetection({
    detectByPointer,
    detectByRect,
  });
  expect(detect(args(false))).toEqual([{ id: "drop:after:root:other-edge" }]);
  expect(detectByPointer).not.toHaveBeenCalled();
});
