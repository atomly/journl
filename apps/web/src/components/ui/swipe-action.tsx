"use client";

import * as React from "react";
import { cn } from "~/lib/cn";

type SwipeActionProps = {
  action: React.ReactNode;
  actionWidth?: number;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  openThreshold?: number;
};

const DIRECTION_LOCK_DISTANCE = 6;
const DRAG_DELTA_TO_SUPPRESS_CLICK = 8;

export function SwipeAction({
  action,
  actionWidth = 80,
  children,
  className,
  contentClassName,
  disabled = false,
  onOpenChange,
  openThreshold,
}: SwipeActionProps) {
  const [offset, setOffset] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const actionElementRef = React.useRef<HTMLDivElement>(null);
  const contentElementRef = React.useRef<HTMLDivElement>(null);
  const dragStateRef = React.useRef({
    hasLockedDirection: false,
    isHorizontalDrag: false,
    isPointerDown: false,
    startOffset: 0,
    startX: 0,
    startY: 0,
  });
  const suppressClickRef = React.useRef(false);

  const maxOffset = actionWidth;
  const settleThreshold = openThreshold ?? actionWidth / 2;

  const setOpen = React.useCallback(
    (open: boolean) => {
      setOffset(open ? maxOffset : 0);
      onOpenChange?.(open);
    },
    [maxOffset, onOpenChange],
  );

  React.useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled, setOpen]);

  const resetDragState = React.useCallback(() => {
    dragStateRef.current = {
      hasLockedDirection: false,
      isHorizontalDrag: false,
      isPointerDown: false,
      startOffset: 0,
      startX: 0,
      startY: 0,
    };
    setIsDragging(false);
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) {
      return;
    }

    dragStateRef.current = {
      hasLockedDirection: false,
      isHorizontalDrag: false,
      isPointerDown: true,
      startOffset: offset,
      startX: event.clientX,
      startY: event.clientY,
    };

    contentElementRef.current?.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;

    if (!dragState.isPointerDown || disabled) {
      return;
    }

    const deltaX = dragState.startX - event.clientX;
    const deltaY = dragState.startY - event.clientY;
    const absoluteDeltaX = Math.abs(deltaX);
    const absoluteDeltaY = Math.abs(deltaY);

    if (!dragState.hasLockedDirection) {
      if (
        absoluteDeltaX < DIRECTION_LOCK_DISTANCE &&
        absoluteDeltaY < DIRECTION_LOCK_DISTANCE
      ) {
        return;
      }

      dragState.hasLockedDirection = true;
      dragState.isHorizontalDrag = absoluteDeltaX > absoluteDeltaY;

      if (!dragState.isHorizontalDrag) {
        resetDragState();
        return;
      }
    }

    if (!dragState.isHorizontalDrag) {
      return;
    }

    event.preventDefault();
    setIsDragging(true);
    if (absoluteDeltaX > DRAG_DELTA_TO_SUPPRESS_CLICK) {
      suppressClickRef.current = true;
    }

    const nextOffset = Math.min(
      maxOffset,
      Math.max(0, dragState.startOffset + deltaX),
    );
    setOffset(nextOffset);
  };

  const handlePointerUp = () => {
    const isOpen = offset > settleThreshold;
    setOpen(isOpen);
    resetDragState();
  };

  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (offset === 0) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    const clickedAction = actionElementRef.current?.contains(target) ?? false;
    const clickedContent = contentElementRef.current?.contains(target) ?? false;

    if (clickedContent && !clickedAction) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div
      className={cn("relative overflow-hidden rounded-md", className)}
      onClickCapture={handleClickCapture}
    >
      <div
        ref={actionElementRef}
        className="absolute inset-y-0 right-0 flex items-stretch"
        style={{ width: actionWidth }}
      >
        {action}
      </div>

      <div
        ref={contentElementRef}
        className={cn(
          "relative touch-pan-y bg-sidebar transition-transform duration-200",
          isDragging && "transition-none",
          contentClassName,
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ transform: `translate3d(${-offset}px, 0, 0)` }}
      >
        {children}
      </div>
    </div>
  );
}
