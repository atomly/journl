// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import {
  type ExploreCamera,
  INITIAL_CAMERA,
  useExploreCamera,
  zoomExploreAt,
} from "../src/app/(app)/graph/_components/use-explore-camera";

async function setup() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let camera = INITIAL_CAMERA;
  function Canvas() {
    const [state, setState] = useState<ExploreCamera>(INITIAL_CAMERA);
    camera = state;
    const events = useExploreCamera(state, setState, 800, 400);
    return (
      <svg {...events}>
        <title>Explore camera test canvas</title>
        <foreignObject>
          <button type="button">Note</button>
        </foreignObject>
      </svg>
    );
  }
  await act(async () => root.render(<Canvas />));
  const svg = container.querySelector("svg") as SVGSVGElement;
  svg.getBoundingClientRect = () => new DOMRect(0, 0, 800, 400);
  svg.setPointerCapture = vi.fn();
  async function pointer(
    type: string,
    id: number,
    x: number,
    y: number,
    target: Element = svg,
  ) {
    await act(async () => {
      const event = new MouseEvent(type, {
        bubbles: true,
        button: 0,
        cancelable: true,
        clientX: x,
        clientY: y,
      });
      Object.defineProperties(event, {
        pointerId: { value: id },
        pointerType: { value: "touch" },
      });
      target.dispatchEvent(event);
    });
  }
  return {
    camera: () => camera,
    cleanup: async () => {
      await act(async () => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
    },
    pointer,
    svg,
  };
}

test("zoom keeps the content point under the gesture anchor and clamps bounds", () => {
  const camera = { x: 30, y: -10, zoom: 1 };
  const anchor = { x: 120, y: 160 };
  const center = { x: 400, y: 200 };
  const next = zoomExploreAt(camera, 1.5, anchor, center);
  expect((anchor.x - center.x - next.x) / next.zoom).toBeCloseTo(
    (anchor.x - center.x - camera.x) / camera.zoom,
  );
  expect((anchor.y - center.y - next.y) / next.zoom).toBeCloseTo(
    (anchor.y - center.y - camera.y) / camera.zoom,
  );
  expect(zoomExploreAt(camera, 10, anchor, center).zoom).toBe(2);
  expect(zoomExploreAt(camera, 0.1, anchor, center).zoom).toBe(0.75);
});

test("two touch pointers pinch from first movement, preserve midpoint, and allow remaining-finger pan", async () => {
  const view = await setup();
  try {
    await view.pointer(
      "pointerdown",
      1,
      200,
      200,
      view.svg.querySelector("button") as Element,
    );
    await view.pointer("pointerdown", 2, 400, 200);
    await view.pointer("pointermove", 1, 100, 200);
    expect(view.camera()).toEqual({ x: 0, y: 0, zoom: 1.5 });
    await view.pointer("pointermove", 2, 500, 200);
    expect(view.camera()).toEqual({ x: 100, y: 0, zoom: 2 });
    await view.pointer("pointerup", 2, 500, 200);
    await view.pointer("pointermove", 1, 130, 210);
    expect(view.camera()).toEqual({ x: 130, y: 10, zoom: 2 });
    await view.pointer("pointercancel", 1, 130, 210);
    await view.pointer("pointermove", 1, 500, 300);
    expect(view.camera()).toEqual({ x: 130, y: 10, zoom: 2 });
  } finally {
    await view.cleanup();
  }
});

test("trackpad pinch cancels native zoom only on the canvas; ordinary wheel and outside pinch stay native", async () => {
  const view = await setup();
  try {
    const normal = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: -20,
    });
    view.svg.dispatchEvent(normal);
    expect(normal.defaultPrevented).toBe(false);
    expect(view.camera().zoom).toBe(1);
    const pinch = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: 120,
      clientY: 160,
      ctrlKey: true,
      deltaY: -20,
    });
    await act(async () => {
      view.svg.dispatchEvent(pinch);
    });
    expect(pinch.defaultPrevented).toBe(true);
    expect(view.camera().zoom).toBeCloseTo(Math.exp(0.2));
    expect(view.camera().x).toBeGreaterThan(0);
    const outside = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY: -20,
    });
    document.body.dispatchEvent(outside);
    expect(outside.defaultPrevented).toBe(false);
  } finally {
    await view.cleanup();
  }
});

test("Safari gesture events zoom in the canvas and listeners are cleaned on unmount", async () => {
  const view = await setup();
  const svg = view.svg;
  try {
    function gesture(type: string, scale: number) {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        clientX: { value: 400 },
        clientY: { value: 200 },
        scale: { value: scale },
      });
      return event;
    }
    const start = gesture("gesturestart", 1);
    svg.dispatchEvent(start);
    expect(start.defaultPrevented).toBe(true);
    const change = gesture("gesturechange", 1.5);
    await act(async () => {
      svg.dispatchEvent(change);
    });
    expect(view.camera().zoom).toBe(1.5);
  } finally {
    await view.cleanup();
  }
  const wheel = new WheelEvent("wheel", {
    cancelable: true,
    ctrlKey: true,
    deltaY: -20,
  });
  svg.dispatchEvent(wheel);
  expect(wheel.defaultPrevented).toBe(false);
});
