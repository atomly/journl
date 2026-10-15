// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AppHeader } from "~/app/(app)/@header/_components/app-header";

const fixture = vi.hoisted(() => ({
  isMobile: true,
  scrollElement: null as HTMLDivElement | null,
}));

vi.mock("~/hooks/use-mobile", () => ({
  useIsMobile: () => fixture.isMobile,
}));
vi.mock("~/app/_components/app-layout-provider", () => ({
  useAppLayout: () => ({ scrollElement: fixture.scrollElement }),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  fixture.isMobile = true;
  fixture.scrollElement = document.createElement("div");
  Object.defineProperties(fixture.scrollElement, {
    clientHeight: { value: 400 },
    scrollHeight: { value: 2000 },
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function render() {
  await act(async () => {
    root.render(
      <AppHeader>
        <button type="button">Search</button>
      </AppHeader>,
    );
  });
}

async function scrollTo(...positions: number[]) {
  for (const position of positions) {
    await act(async () => {
      if (fixture.scrollElement) {
        fixture.scrollElement.scrollTop = position;
        fixture.scrollElement.dispatchEvent(new Event("scroll"));
      }
      vi.advanceTimersToNextFrame();
    });
  }
}

function isHidden() {
  return container
    .querySelector("header")
    ?.classList.contains("-translate-y-[calc(100%+2rem)]");
}

test("slow scrolling hides and reveals the header across multiple frames", async () => {
  await render();
  await scrollTo(8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96, 104);
  expect(isHidden()).toBe(true);
  await scrollTo(96, 88, 80, 72, 64, 56, 48, 40, 32);
  expect(isHidden()).toBe(false);
});

test("small direction reversals do not reveal the header", async () => {
  await render();
  await scrollTo(200, 180, 185, 165, 170, 150, 155);
  expect(isHidden()).toBe(true);
  await scrollTo(135, 115, 95, 75);
  expect(isHidden()).toBe(false);
});

test("returning to the top reveals immediately and ignores top bounce", async () => {
  await render();
  await scrollTo(60);
  expect(isHidden()).toBe(true);
  await scrollTo(12, -80, 0);
  expect(isHidden()).toBe(false);
});

test("bottom overscroll settling does not look like an upward gesture", async () => {
  await render();
  await scrollTo(1600, 1720, 1600);
  expect(isHidden()).toBe(true);
});

test("switching to desktop cancels pending scroll work and keeps the header visible", async () => {
  await render();
  await scrollTo(200);
  expect(isHidden()).toBe(true);
  const cancel = vi.spyOn(window, "cancelAnimationFrame");
  fixture.scrollElement?.dispatchEvent(new Event("scroll"));
  fixture.isMobile = false;
  await render();
  expect(cancel).toHaveBeenCalledOnce();
  await scrollTo(400);
  expect(isHidden()).toBe(false);
});

test("switching scroll containers resets gesture tracking and detaches the old listener", async () => {
  await render();
  await scrollTo(200);
  const oldElement = fixture.scrollElement;
  fixture.scrollElement = oldElement?.cloneNode() as HTMLDivElement;
  await render();
  expect(isHidden()).toBe(false);
  await act(async () => {
    if (oldElement) {
      oldElement.scrollTop = 400;
      oldElement.dispatchEvent(new Event("scroll"));
    }
    vi.advanceTimersToNextFrame();
  });
  expect(isHidden()).toBe(false);
});
