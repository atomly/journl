"use client";

import * as React from "react";
import { cn } from "~/lib/cn";

type SwipeActionContextValue = {
  actionElementRef: React.RefObject<HTMLDivElement | null>;
  actionWidth: number;
  contentElementRef: React.RefObject<HTMLDivElement | null>;
  disabled: boolean;
  handlePointerCancel: () => void;
  handlePointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  handlePointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  handlePointerUp: () => void;
  isDragging: boolean;
  offset: number;
};

const SwipeActionContext = React.createContext<SwipeActionContextValue | null>(
  null,
);

const DIRECTION_LOCK_DISTANCE = 6;
const DRAG_DELTA_TO_SUPPRESS_CLICK = 8;

function setRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }

  if (ref && typeof ref === "object") {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
}

function useSwipeActionContext(componentName: string) {
  const context = React.useContext(SwipeActionContext);
  if (!context) {
    throw new Error(`${componentName} must be used within SwipeAction.`);
  }

  return context;
}

type SwipeActionProps = React.ComponentProps<"div"> & {
  actionWidth?: number;
  disabled?: boolean;
  fullSwipeThresholdRatio?: number;
  onFullSwipe?: () => void;
  onOpenChange?: (open: boolean) => void;
  openThreshold?: number;
};

function SwipeAction({
  actionWidth = 80,
  children,
  className,
  disabled = false,
  fullSwipeThresholdRatio = 0.68,
  onClickCapture,
  onFullSwipe,
  onOpenChange,
  openThreshold,
  ref,
  ...props
}: SwipeActionProps) {
  const [offset, setOffset] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const rootElementRef = React.useRef<HTMLDivElement>(null);
  const actionElementRef = React.useRef<HTMLDivElement>(null);
  const contentElementRef = React.useRef<HTMLDivElement>(null);
  const dragStateRef = React.useRef({
    hasLockedDirection: false,
    isHorizontalDrag: false,
    isPointerDown: false,
    maxSwipeOffset: actionWidth,
    startOffset: 0,
    startX: 0,
    startY: 0,
  });
  const suppressClickRef = React.useRef(false);

  const settleThreshold = openThreshold ?? actionWidth / 2;

  const setOpen = React.useCallback(
    (open: boolean) => {
      setOffset(open ? actionWidth : 0);
      onOpenChange?.(open);
    },
    [actionWidth, onOpenChange],
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
      maxSwipeOffset: actionWidth,
      startOffset: 0,
      startX: 0,
      startY: 0,
    };
    setIsDragging(false);
  }, [actionWidth]);

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || event.button !== 0) {
        return;
      }

      dragStateRef.current = {
        hasLockedDirection: false,
        isHorizontalDrag: false,
        isPointerDown: true,
        maxSwipeOffset: rootElementRef.current?.clientWidth ?? actionWidth,
        startOffset: offset,
        startX: event.clientX,
        startY: event.clientY,
      };

      contentElementRef.current?.setPointerCapture(event.pointerId);
    },
    [actionWidth, disabled, offset],
  );

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
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
        dragState.maxSwipeOffset,
        Math.max(0, dragState.startOffset + deltaX),
      );
      setOffset(nextOffset);
    },
    [disabled, resetDragState],
  );

  const handlePointerUp = React.useCallback(() => {
    const dragState = dragStateRef.current;

    if (!dragState.isPointerDown && !isDragging) {
      return;
    }

    const fullSwipeThreshold =
      dragState.maxSwipeOffset * fullSwipeThresholdRatio;

    if (onFullSwipe && offset >= fullSwipeThreshold) {
      suppressClickRef.current = true;
      setOpen(false);
      onFullSwipe();
      resetDragState();
      return;
    }

    setOpen(offset > settleThreshold);
    resetDragState();
  }, [
    fullSwipeThresholdRatio,
    isDragging,
    offset,
    onFullSwipe,
    resetDragState,
    setOpen,
    settleThreshold,
  ]);

  const handlePointerCancel = React.useCallback(() => {
    const dragState = dragStateRef.current;
    setOffset(dragState.startOffset);
    resetDragState();
  }, [resetDragState]);

  const handleClickCapture = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const clickedAction = actionElementRef.current?.contains(target) ?? false;
      if (clickedAction) {
        return;
      }

      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (offset === 0) {
        return;
      }

      const clickedContent =
        contentElementRef.current?.contains(target) ?? false;
      if (clickedContent) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    },
    [offset, setOpen],
  );

  const contextValue = React.useMemo<SwipeActionContextValue>(
    () => ({
      actionElementRef,
      actionWidth,
      contentElementRef,
      disabled,
      handlePointerCancel,
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
      isDragging,
      offset,
    }),
    [
      actionWidth,
      disabled,
      handlePointerCancel,
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
      isDragging,
      offset,
    ],
  );

  return (
    <SwipeActionContext.Provider value={contextValue}>
      <div
        data-slot="swipe-action"
        data-state={offset > 0 ? "open" : "closed"}
        className={cn("relative overflow-hidden", className)}
        onClickCapture={(event) => {
          handleClickCapture(event);
          onClickCapture?.(event);
        }}
        ref={(node) => {
          rootElementRef.current = node;
          setRef(ref, node);
        }}
        {...props}
      >
        {children}
      </div>
    </SwipeActionContext.Provider>
  );
}

function SwipeActionReveal({
  className,
  ref,
  style,
  ...props
}: React.ComponentProps<"div">) {
  const { actionElementRef, actionWidth, offset } =
    useSwipeActionContext("SwipeActionReveal");

  return (
    <div
      data-slot="swipe-action-reveal"
      data-state={offset > 0 ? "open" : "closed"}
      className={cn(
        "absolute inset-y-0 right-0 flex items-stretch justify-end overflow-hidden",
        className,
      )}
      ref={(node) => {
        actionElementRef.current = node;
        setRef(ref, node);
      }}
      style={{
        width: Math.max(actionWidth, offset),
        ...style,
      }}
      {...props}
    />
  );
}

function SwipeActionContent({
  className,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  ref,
  style,
  ...props
}: React.ComponentProps<"div">) {
  const {
    contentElementRef,
    disabled,
    handlePointerCancel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    isDragging,
    offset,
  } = useSwipeActionContext("SwipeActionContent");

  return (
    <div
      data-slot="swipe-action-content"
      data-state={offset > 0 ? "open" : "closed"}
      data-disabled={disabled ? "true" : "false"}
      className={cn(
        "relative touch-pan-y bg-sidebar transition-transform duration-200",
        isDragging && "transition-none",
        className,
      )}
      ref={(node) => {
        contentElementRef.current = node;
        setRef(ref, node);
      }}
      onPointerDown={(event) => {
        handlePointerDown(event);
        onPointerDown?.(event);
      }}
      onPointerMove={(event) => {
        handlePointerMove(event);
        onPointerMove?.(event);
      }}
      onPointerUp={(event) => {
        handlePointerUp();
        onPointerUp?.(event);
      }}
      onPointerCancel={(event) => {
        handlePointerCancel();
        onPointerCancel?.(event);
      }}
      style={{
        transform: `translate3d(${-offset}px, 0, 0)`,
        ...style,
      }}
      {...props}
    />
  );
}

export { SwipeAction, SwipeActionReveal, SwipeActionContent };
