import {
  pointerWithin,
  rectIntersection,
  type Collision,
  type CollisionDetection,
} from "@dnd-kit/core";

export const TREE_REORDER_BEFORE_BAND_CLASSNAME = "top-0 h-2";
export const TREE_REORDER_AFTER_BAND_CLASSNAME = "bottom-0 h-2";
export const TREE_REORDER_BEFORE_LINE_CLASSNAME = "top-0";
export const TREE_REORDER_AFTER_LINE_CLASSNAME = "bottom-0";
export const TREE_INSIDE_DROP_ZONE_CLASSNAME =
  "absolute inset-x-0 inset-y-2 z-20";

function getTreeDropTargetPriority(id: Collision["id"]) {
  if (typeof id !== "string" || !id.startsWith("drop:")) {
    return 2;
  }

  const [, type] = id.split(":");

  if (type === "inside" || type === "parent") {
    return 0;
  }

  if (type === "before" || type === "after") {
    return 1;
  }

  return 2;
}

export function prioritizeTreeCollisions(collisions: Collision[]) {
  return collisions
    .map((collision, index) => ({
      collision,
      index,
      priority: getTreeDropTargetPriority(collision.id),
    }))
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }

      return left.index - right.index;
    })
    .map(({ collision }) => collision);
}

export function createTreeCollisionDetection({
  detectByPointer = pointerWithin,
  detectByRect = rectIntersection,
}: {
  detectByPointer?: CollisionDetection;
  detectByRect?: CollisionDetection;
} = {}): CollisionDetection {
  return (args) => {
    const pointerCollisions = prioritizeTreeCollisions(detectByPointer(args));
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }

    return prioritizeTreeCollisions(detectByRect(args));
  };
}

export const treeCollisionDetection = createTreeCollisionDetection();
