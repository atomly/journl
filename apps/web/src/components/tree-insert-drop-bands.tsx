"use client";
import { useDndContext, useDroppable } from "@dnd-kit/core";
import { cn } from "~/lib/cn";
import {
  TREE_REORDER_AFTER_BAND_CLASSNAME,
  TREE_REORDER_AFTER_LINE_CLASSNAME,
  TREE_REORDER_BEFORE_BAND_CLASSNAME,
  TREE_REORDER_BEFORE_LINE_CLASSNAME,
} from "~/lib/tree-dnd";
import { getAfterDropId, getBeforeDropId } from "~/lib/tree-model";

function TreeInsertDropBand({
  activeDragId,
  bandClassName,
  dropId,
  isDnDEnabled,
  isSiblingOver = false,
  lineClassName,
  showLine = true,
}: {
  activeDragId: string | null;
  bandClassName: string;
  dropId: string;
  isDnDEnabled: boolean;
  isSiblingOver?: boolean;
  lineClassName?: string;
  showLine?: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
  });
  const isDragActive = isDnDEnabled && !!activeDragId;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute inset-x-0 z-20",
        bandClassName,
        isDragActive ? "pointer-events-auto" : "pointer-events-none",
      )}
    >
      <div
        className={cn(
          "absolute right-0 left-1 h-0.5 rounded-full bg-primary",
          lineClassName,
          isDragActive && (isOver || isSiblingOver) && showLine
            ? "opacity-100"
            : "opacity-0",
        )}
      />
    </div>
  );
}

export function TreeInsertDropBands({
  afterBandClassName = TREE_REORDER_AFTER_BAND_CLASSNAME,
  afterLineClassName = TREE_REORDER_AFTER_LINE_CLASSNAME,
  afterSiblingDropId,
  activeDragId,
  anchorEdgeId,
  beforeBandClassName = TREE_REORDER_BEFORE_BAND_CLASSNAME,
  beforeLineClassName = TREE_REORDER_BEFORE_LINE_CLASSNAME,
  isDnDEnabled,
  parentNodeId,
  showAfter = true,
  showBefore = true,
  showBeforeLine = true,
}: {
  afterBandClassName?: string;
  afterLineClassName?: string;
  afterSiblingDropId?: string;
  activeDragId: string | null;
  anchorEdgeId: string;
  beforeBandClassName?: string;
  beforeLineClassName?: string;
  isDnDEnabled: boolean;
  parentNodeId: string | null;
  showAfter?: boolean;
  showBefore?: boolean;
  showBeforeLine?: boolean;
}) {
  const { over } = useDndContext();
  const isAfterSiblingOver =
    !!afterSiblingDropId && over?.id === afterSiblingDropId;

  return (
    <>
      {showBefore ? (
        <TreeInsertDropBand
          activeDragId={activeDragId}
          bandClassName={beforeBandClassName}
          dropId={getBeforeDropId({
            anchorEdgeId,
            parentNodeId,
          })}
          isDnDEnabled={isDnDEnabled}
          lineClassName={beforeLineClassName}
          showLine={showBeforeLine}
        />
      ) : null}
      {showAfter ? (
        <TreeInsertDropBand
          activeDragId={activeDragId}
          bandClassName={afterBandClassName}
          dropId={getAfterDropId({
            anchorEdgeId,
            parentNodeId,
          })}
          isDnDEnabled={isDnDEnabled}
          isSiblingOver={isAfterSiblingOver}
          lineClassName={afterLineClassName}
        />
      ) : null}
    </>
  );
}
