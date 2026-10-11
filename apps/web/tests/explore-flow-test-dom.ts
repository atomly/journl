import { vi } from "vitest";

/** jsdom has no layout; supply the DOM measurements React Flow reads. */
export function mockFlowDom() {
  class Observer {
    constructor(private callback: ResizeObserverCallback) {}
    observe(target: Element) {
      queueMicrotask(() =>
        this.callback(
          [
            {
              contentRect: { height: 520, width: 900 },
              target,
            } as ResizeObserverEntry,
          ],
          this as unknown as ResizeObserver,
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
