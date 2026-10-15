import { vi } from "vitest";

/** jsdom has no layout; supply the DOM measurements React Flow reads. */
export function mockFlowDom() {
  class Observer implements ResizeObserver {
    constructor(private callback: ResizeObserverCallback) {}
    observe(target: Element) {
      queueMicrotask(() =>
        this.callback(
          [
            {
              borderBoxSize: [{ blockSize: 520, inlineSize: 900 }],
              contentBoxSize: [{ blockSize: 520, inlineSize: 900 }],
              contentRect: DOMRectReadOnly.fromRect({
                height: 520,
                width: 900,
              }),
              devicePixelContentBoxSize: [{ blockSize: 520, inlineSize: 900 }],
              target,
            } satisfies ResizeObserverEntry,
          ],
          this,
        ),
      );
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", Observer);
  vi.stubGlobal(
    "DOMMatrixReadOnly",
    class {
      m22: number;
      constructor(transform: string) {
        this.m22 = Number(/scale\(([\d.]+)\)/.exec(transform)?.[1] ?? 1);
      }
    },
  );
  for (const [name, fallback] of [
    ["offsetWidth", 900],
    ["offsetHeight", 520],
  ] as const) {
    vi.spyOn(HTMLElement.prototype, name, "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return (
        Number.parseFloat(
          this.style[name === "offsetWidth" ? "width" : "height"],
        ) || fallback
      );
    });
  }
}
