import {
  type Collision,
  type CollisionDetection,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useDroppable,
} from "@dnd-kit/core";

function canStartTreeDrag(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  const control = target.closest(
    "button, a, input, textarea, select, [contenteditable=true], [draggable=true]",
  );
  return !control || control.hasAttribute("data-tree-drag-handle");
}

export class TreeMouseSensor extends MouseSensor {
  static activators = MouseSensor.activators.map((activator) => ({
    ...activator,
    handler: (...args: Parameters<typeof activator.handler>) =>
      canStartTreeDrag(args[0].nativeEvent.target) &&
      activator.handler(...args),
  }));
}

export class TreeTouchSensor extends TouchSensor {
  static activators = TouchSensor.activators.map((activator) => ({
    ...activator,
    handler: (...args: Parameters<typeof activator.handler>) =>
      canStartTreeDrag(args[0].nativeEvent.target) &&
      activator.handler(...args),
  }));
}

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
    const activeData = args.active.data.current;
    const collisions = args.pointerCoordinates
      ? detectByPointer(args)
      : detectByRect(args);

    return prioritizeTreeCollisions(
      collisions.filter(({ id }) => {
        if (typeof id !== "string") return false;
        const [, type, , edgeId] = id.split(":");
        if (type === "before" || type === "after") {
          return edgeId !== activeData?.edgeId;
        }
        return id !== `drop:inside:${activeData?.item?.nodeId}`;
      }),
    );
  };
}

export const treeCollisionDetection = createTreeCollisionDetection();

export function TreeEndDropTarget({
  parentNodeId,
  active,
}: {
  parentNodeId: string | null;
  active: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `drop:end:${parentNodeId ?? "root"}`,
  });
  return (
    <div
      ref={setNodeRef}
      data-slot="tree-end-drop-target"
      className={`min-h-7 flex-1 rounded-md ${active ? "pointer-events-auto" : "pointer-events-none"} ${active && isOver ? "border border-primary border-dashed bg-primary/10" : ""}`}
    />
  );
}

export function TreeDragOverlay({ label }: { label: string | null }) {
  return (
    <DragOverlay dropAnimation={null}>
      {label ? (
        <div className="flex h-7 items-center gap-2 rounded-md bg-sidebar-accent px-2 text-sm shadow-md ring-1 ring-sidebar-border">
          {label}
        </div>
      ) : null}
    </DragOverlay>
  );
}
