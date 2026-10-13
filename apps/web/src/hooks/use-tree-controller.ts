"use client";
import {
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  MeasuringStrategy,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMoveTreeItem } from "~/hooks/use-move-tree-item";
import {
  createTreeCollisionDetection,
  TreeMouseSensor,
  TreeTouchSensor,
} from "~/lib/tree-dnd";
import {
  isValidTreeDestination,
  parseDropTarget,
  type TreeDragData,
} from "~/lib/tree-model";

const DRAG_CLICK_SUPPRESSION_MS = 200;
export function useTreeController() {
  const {
    mutate: moveItem,
    isPending: isMovingItem,
    loadedItems,
  } = useMoveTreeItem();
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null);
  const hoverExpandTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const hoverFolderIdRef = useRef<string | null>(null);
  const recentDragUntilRef = useRef(0);
  const clearHoverExpandTimeout = useCallback(() => {
    if (hoverExpandTimeoutRef.current) {
      clearTimeout(hoverExpandTimeoutRef.current);
      hoverExpandTimeoutRef.current = null;
    }
    hoverFolderIdRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearHoverExpandTimeout();
    };
  }, [clearHoverExpandTimeout]);

  const setFolderOpen = useCallback((folderNodeId: string, open: boolean) => {
    setOpenFolders((previous) => {
      if (previous[folderNodeId] === open) {
        return previous;
      }

      return {
        ...previous,
        [folderNodeId]: open,
      };
    });
  }, []);

  const markRecentDrag = useCallback(() => {
    recentDragUntilRef.current = Date.now() + DRAG_CLICK_SUPPRESSION_MS;
  }, []);

  const shouldSuppressClick = useCallback(() => {
    return Date.now() < recentDragUntilRef.current;
  }, []);

  const isDnDEnabled = !isMovingItem;
  const mouseSensor = useSensor(TreeMouseSensor, {
    activationConstraint: { distance: 5 },
  });
  const touchSensor = useSensor(TreeTouchSensor, {
    activationConstraint: { delay: 300, tolerance: 8 },
  });
  const sensors = useSensors(mouseSensor, touchSensor);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      navigator.vibrate?.(50);
      markRecentDrag();
      setActiveDragId(String(event.active.id));
      const dragData = event.active.data.current as TreeDragData | undefined;
      setActiveDragLabel(dragData?.label ?? null);
    },
    [markRecentDrag],
  );

  const handleDragCancel = useCallback(
    (_event: DragCancelEvent) => {
      clearHoverExpandTimeout();
      markRecentDrag();
      setActiveDragId(null);
      setActiveDragLabel(null);
    },
    [clearHoverExpandTimeout, markRecentDrag],
  );

  const handleFolderInsideHover = useCallback(
    (folderNodeId: string) => {
      if (!isDnDEnabled) {
        return;
      }

      if (openFolders[folderNodeId]) {
        clearHoverExpandTimeout();
        return;
      }

      if (hoverFolderIdRef.current === folderNodeId) {
        return;
      }

      clearHoverExpandTimeout();
      hoverFolderIdRef.current = folderNodeId;
      hoverExpandTimeoutRef.current = setTimeout(() => {
        setFolderOpen(folderNodeId, true);
      }, 700);
    },
    [clearHoverExpandTimeout, openFolders, setFolderOpen, isDnDEnabled],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      if (!isDnDEnabled) {
        return;
      }

      const dropTarget = parseDropTarget(event.over?.id);
      if (dropTarget?.type !== "inside" || !dropTarget.parentNodeId) {
        clearHoverExpandTimeout();
        return;
      }

      handleFolderInsideHover(dropTarget.parentNodeId);
    },
    [clearHoverExpandTimeout, handleFolderInsideHover, isDnDEnabled],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      clearHoverExpandTimeout();
      markRecentDrag();
      setActiveDragId(null);
      setActiveDragLabel(null);

      if (!isDnDEnabled) {
        return;
      }

      const activeData = event.active.data.current as TreeDragData | undefined;
      if (!activeData?.item) {
        return;
      }

      const dropTarget = parseDropTarget(event.over?.id);
      if (!dropTarget) {
        return;
      }

      const destination =
        dropTarget.type === "before" || dropTarget.type === "after"
          ? {
              anchor_edge_id: dropTarget.anchorEdgeId,
              parent_node_id: dropTarget.parentNodeId,
              position: dropTarget.type,
            }
          : {
              parent_node_id: dropTarget.parentNodeId,
              ...(dropTarget.type === "end"
                ? { position: "after" as const }
                : {}),
            };

      if (
        activeData.item.kind === "folder" &&
        !isValidTreeDestination(
          activeData.item.nodeId,
          destination.parent_node_id,
          loadedItems(),
        )
      ) {
        return;
      }

      moveItem({
        destination,
        node_id: activeData.item.nodeId,
      });
    },
    [
      clearHoverExpandTimeout,
      markRecentDrag,
      moveItem,
      isDnDEnabled,
      loadedItems,
    ],
  );

  const collisionDetection = useMemo(
    () =>
      createTreeCollisionDetection({
        isValidDestination: (nodeId, parentId) =>
          isValidTreeDestination(nodeId, parentId, loadedItems()),
      }),
    [loadedItems],
  );
  return {
    activeDragId,
    activeDragLabel,
    dndContextProps: {
      accessibility: {
        announcements: {
          onDragCancel: () => "Move cancelled.",
          onDragEnd: ({ active, over }: DragEndEvent) =>
            over
              ? `Saving the new position of ${active.data.current?.label ?? "item"}.`
              : "Move cancelled.",
          onDragOver: ({ over }: DragOverEvent) => {
            const target = parseDropTarget(over?.id);
            if (!target) return "Outside the drop area.";
            const anchor =
              "anchorEdgeId" in target
                ? loadedItems().find(
                    (item) => item.edge_id === target.anchorEdgeId,
                  )
                : undefined;
            const folder = loadedItems().find(
              (item) => item.node_id === target.parentNodeId,
            );
            const label = anchor
              ? anchor.kind === "folder"
                ? anchor.folder.name
                : anchor.page.title
              : folder?.kind === "folder"
                ? folder.folder.name
                : "Library";
            return anchor
              ? `Place ${target.type} ${label || "item"}.`
              : `Place in ${label || "folder"}.`;
          },
          onDragStart: ({ active }: DragStartEvent) =>
            `Picked up ${active.data.current?.label ?? "item"}.`,
        },
        screenReaderInstructions: {
          draggable:
            "Use the item's actions menu to move up, move down, or choose a folder. On touch screens, hold an item to drag.",
        },
      },
      collisionDetection,
      measuring: { droppable: { strategy: MeasuringStrategy.Always } },
      onDragCancel: handleDragCancel,
      onDragEnd: handleDragEnd,
      onDragOver: handleDragOver,
      onDragStart: handleDragStart,
      sensors,
    },
    isDnDEnabled,
    openFolders,
    setFolderOpen,
    setOpenFolders,
    shouldSuppressClick,
  };
}
