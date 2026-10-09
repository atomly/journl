// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { ExplorePageScroll } from "../src/app/(app)/explore/_components/explore-page-scroll";
import { ExploreStateProvider } from "../src/app/(app)/explore/_components/explore-state-provider";

const mock = vi.hoisted(() => ({
  element: null as HTMLElement | null,
  route: "/explore",
}));
vi.mock("next/navigation", () => ({
  usePathname: () => mock.route,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../src/app/_components/app-layout-provider", () => ({
  useAppLayout: () => ({ scrollElement: mock.element }),
}));
test("scrollbar/touch gestures keep saving after rerenders and Back restores the final position", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  sessionStorage.clear();
  const container = document.createElement("div");
  mock.element = container;
  const root = createRoot(container);
  const observers: (() => void)[] = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        observers.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
  const render = () =>
    act(async () =>
      root.render(
        <ExploreStateProvider owner="scroll-owner">
          <ExplorePageScroll>
            <div>Route content</div>
          </ExplorePageScroll>
        </ExploreStateProvider>,
      ),
    );
  try {
    await render();
    await act(async () => container.dispatchEvent(new Event("pointerdown")));
    for (const position of [120, 480])
      await act(async () => {
        container.scrollTop = position;
        container.dispatchEvent(new Event("scroll"));
      });
    await act(async () => observers.at(-1)?.());
    expect(container.scrollTop).toBe(480);
    expect(
      sessionStorage.getItem("journl:explore:scroll-owner:page:/explore?"),
    ).toBe("480");
    mock.route = "/explore/clusters/thread";
    await render();
    expect(container.scrollTop).toBe(0);
    mock.route = "/explore";
    await render();
    expect(container.scrollTop).toBe(480);
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
    sessionStorage.clear();
    mock.element = null;
  }
});
