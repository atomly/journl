// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { PwaZoomGuard } from "./pwa-zoom-guard";

function gesture(type: string, touches?: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  if (touches !== undefined) {
    Object.defineProperty(event, "touches", { value: { length: touches } });
  }
  return event;
}

test.each(["browser", "display-mode", "ios-standalone"])(
  "%s scopes Safari zoom prevention and cleans up without swallowing app events",
  async (mode) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("matchMedia", () => ({ matches: mode === "display-mode" }));
    const original = Object.getOwnPropertyDescriptor(navigator, "standalone");
    Object.defineProperty(navigator, "standalone", {
      configurable: true,
      value: mode === "ios-standalone",
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const seen = vi.fn();
    container.addEventListener("gesturechange", seen);
    try {
      await act(() => root.render(<PwaZoomGuard />));
      expect(document.documentElement.hasAttribute("data-pwa-standalone")).toBe(
        mode !== "browser",
      );
      for (const event of [
        gesture("gesturestart"),
        gesture("gesturechange"),
        gesture("touchmove", 2),
      ]) {
        container.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(mode !== "browser");
      }
      expect(seen).toHaveBeenCalledOnce();
      for (const event of [
        gesture("touchmove", 1),
        gesture("touchend", 0),
        gesture("click"),
      ]) {
        container.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
      }
      await act(() => root.unmount());
      expect(document.documentElement.hasAttribute("data-pwa-standalone")).toBe(
        false,
      );
      const afterUnmount = gesture("gesturestart");
      container.dispatchEvent(afterUnmount);
      expect(afterUnmount.defaultPrevented).toBe(false);
    } finally {
      container.remove();
      if (original) Object.defineProperty(navigator, "standalone", original);
      else Reflect.deleteProperty(navigator, "standalone");
      vi.unstubAllGlobals();
    }
  },
);
