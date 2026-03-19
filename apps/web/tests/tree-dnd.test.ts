import type { Collision, CollisionDetection } from "@dnd-kit/core";
import { expect, test } from "vitest";
import {
  createTreeCollisionDetection,
  prioritizeTreeCollisions,
} from "../src/lib/tree-dnd";

const detectionArgs = {} as Parameters<CollisionDetection>[0];

function createDetectionStub(collisions: Collision[]): CollisionDetection {
  return () => collisions;
}

test("prioritizes inside targets over reorder bands when collisions overlap", () => {
  expect(
    prioritizeTreeCollisions([
      { id: "drop:before:root:edge-1" },
      { id: "drop:inside:folder-1" },
      { id: "drop:after:root:edge-2" },
    ]),
  ).toEqual([
    { id: "drop:inside:folder-1" },
    { id: "drop:before:root:edge-1" },
    { id: "drop:after:root:edge-2" },
  ]);
});

test("falls back to rectangle intersections when pointer hits nothing", () => {
  const collisionDetection = createTreeCollisionDetection({
    detectByPointer: createDetectionStub([]),
    detectByRect: createDetectionStub([
      { id: "drop:before:root:edge-1" },
      { id: "drop:inside:folder-1" },
    ]),
  });

  expect(collisionDetection(detectionArgs)).toEqual([
    { id: "drop:inside:folder-1" },
    { id: "drop:before:root:edge-1" },
  ]);
});

test("keeps empty parent drop targets valid when there are no child rows", () => {
  const collisionDetection = createTreeCollisionDetection({
    detectByPointer: createDetectionStub([]),
    detectByRect: createDetectionStub([{ id: "drop:parent:folder-1" }]),
  });

  expect(collisionDetection(detectionArgs)).toEqual([
    { id: "drop:parent:folder-1" },
  ]);
});

test("preserves reorder behavior when only before and after bands collide", () => {
  const collisionDetection = createTreeCollisionDetection({
    detectByPointer: createDetectionStub([
      { id: "drop:before:root:edge-1" },
      { id: "drop:after:root:edge-2" },
    ]),
    detectByRect: createDetectionStub([]),
  });

  expect(collisionDetection(detectionArgs)).toEqual([
    { id: "drop:before:root:edge-1" },
    { id: "drop:after:root:edge-2" },
  ]);
});
