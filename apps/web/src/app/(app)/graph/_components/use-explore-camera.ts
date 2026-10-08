"use client";

import { useCallback, useEffect, useRef } from "react";

export type ExploreCamera = { zoom: number; x: number; y: number };
export const INITIAL_CAMERA: ExploreCamera = { x: 0, y: 0, zoom: 1 };
export const MIN_EXPLORE_ZOOM = 0.75;
export const MAX_EXPLORE_ZOOM = 2;
type Point = { x: number; y: number };

export function zoomExploreAt(
  camera: ExploreCamera,
  zoom: number,
  anchor: Point,
  center: Point,
): ExploreCamera {
  const bounded = Math.max(MIN_EXPLORE_ZOOM, Math.min(MAX_EXPLORE_ZOOM, zoom));
  const ratio = bounded / camera.zoom;
  return {
    x: anchor.x - center.x - (anchor.x - center.x - camera.x) * ratio,
    y: anchor.y - center.y - (anchor.y - center.y - camera.y) * ratio,
    zoom: bounded,
  };
}

export function useExploreCamera(
  camera: ExploreCamera,
  onCamera: (camera: ExploreCamera) => void,
  width: number,
  height: number,
) {
  const ref = useRef<SVGSVGElement>(null);
  const current = useRef(camera);
  current.current = camera;
  const update = useRef(onCamera);
  update.current = onCamera;
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{
    camera: ExploreCamera;
    middle: Point;
    distance: number;
  } | null>(null);
  const drag = useRef<{ camera: ExploreCamera; point: Point } | null>(null);
  const moved = useRef(false);
  const center = { x: width / 2, y: height / 2 };
  function point(x: number, y: number) {
    const bounds = ref.current?.getBoundingClientRect();
    const scale = bounds?.width ? width / bounds.width : 1;
    return {
      x: (x - (bounds?.left ?? 0)) * scale,
      y: (y - (bounds?.top ?? 0)) * scale,
    };
  }
  const apply = useCallback((next: ExploreCamera) => {
    current.current = next;
    update.current(next);
  }, []);
  function rebase() {
    const values = [...pointers.current.values()];
    const a = values[0];
    const b = values[1];
    gesture.current =
      a && b
        ? {
            camera: current.current,
            distance: Math.hypot(a.x - b.x, a.y - b.y),
            middle: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
          }
        : null;
    drag.current = a && !b ? { camera: current.current, point: a } : null;
  }
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    function wheel(event: WheelEvent) {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const bounds = svg?.getBoundingClientRect();
      const scale = bounds?.width ? width / bounds.width : 1;
      const anchor = {
        x: (event.clientX - (bounds?.left ?? 0)) * scale,
        y: (event.clientY - (bounds?.top ?? 0)) * scale,
      };
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1);
      apply(
        zoomExploreAt(
          current.current,
          current.current.zoom * Math.exp(-delta * 0.01),
          anchor,
          { x: width / 2, y: height / 2 },
        ),
      );
    }
    let safariZoom = 1;
    function browserGesture(event: Event) {
      const gestureEvent = event as Event & {
        scale?: number;
        clientX?: number;
        clientY?: number;
      };
      if (typeof gestureEvent.scale !== "number") return;
      event.preventDefault();
      if (pointers.current.size > 1) return;
      if (event.type === "gesturestart") {
        safariZoom = current.current.zoom;
        return;
      }
      const bounds = svg?.getBoundingClientRect();
      const scale = bounds?.width ? width / bounds.width : 1;
      apply(
        zoomExploreAt(
          current.current,
          safariZoom * gestureEvent.scale,
          {
            x:
              ((gestureEvent.clientX ??
                (bounds?.left ?? 0) + (bounds?.width ?? width) / 2) -
                (bounds?.left ?? 0)) *
              scale,
            y:
              ((gestureEvent.clientY ??
                (bounds?.top ?? 0) + (bounds?.height ?? height) / 2) -
                (bounds?.top ?? 0)) *
              scale,
          },
          { x: width / 2, y: height / 2 },
        ),
      );
    }
    svg.addEventListener("wheel", wheel, { passive: false });
    svg.addEventListener("gesturestart", browserGesture, { passive: false });
    svg.addEventListener("gesturechange", browserGesture, { passive: false });
    return () => {
      svg.removeEventListener("wheel", wheel);
      svg.removeEventListener("gesturestart", browserGesture);
      svg.removeEventListener("gesturechange", browserGesture);
    };
  }, [width, height, apply]);
  return {
    onClickCapture(event: React.MouseEvent<SVGSVGElement>) {
      if (moved.current && event.detail !== 0) {
        event.preventDefault();
        event.stopPropagation();
        moved.current = false;
      }
    },
    onLostPointerCapture(event: React.PointerEvent<SVGSVGElement>) {
      if (pointers.current.delete(event.pointerId)) rebase();
    },
    onPointerCancel(event: React.PointerEvent<SVGSVGElement>) {
      pointers.current.delete(event.pointerId);
      rebase();
    },
    onPointerDown(event: React.PointerEvent<SVGSVGElement>) {
      if (
        event.pointerType !== "touch" &&
        (event.button !== 0 ||
          (event.target as Element).closest("button, a, [role=button]"))
      )
        return;
      if (!pointers.current.size) moved.current = false;
      pointers.current.set(
        event.pointerId,
        point(event.clientX, event.clientY),
      );
      if (
        !(event.target as Element).closest("button, a, [role=button]") ||
        pointers.current.size > 1
      ) {
        for (const id of pointers.current.keys())
          event.currentTarget.setPointerCapture(id);
      }
      rebase();
    },
    onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
      if (!pointers.current.has(event.pointerId)) return;
      const next = point(event.clientX, event.clientY);
      pointers.current.set(event.pointerId, next);
      const pinch = gesture.current;
      if (pinch) {
        const [a, b] = [...pointers.current.values()];
        if (!a || !b || pinch.distance < 1) return;
        moved.current = true;
        const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const zoomed = zoomExploreAt(
          pinch.camera,
          (pinch.camera.zoom * Math.hypot(a.x - b.x, a.y - b.y)) /
            pinch.distance,
          pinch.middle,
          center,
        );
        apply({
          ...zoomed,
          x: zoomed.x + middle.x - pinch.middle.x,
          y: zoomed.y + middle.y - pinch.middle.y,
        });
      } else if (drag.current) {
        const dx = next.x - drag.current.point.x;
        const dy = next.y - drag.current.point.y;
        if (Math.hypot(dx, dy) < 4 && !moved.current) return;
        moved.current = true;
        apply({
          ...drag.current.camera,
          x: drag.current.camera.x + dx,
          y: drag.current.camera.y + dy,
        });
      }
    },
    onPointerUp(event: React.PointerEvent<SVGSVGElement>) {
      pointers.current.delete(event.pointerId);
      rebase();
    },
    ref,
  };
}
