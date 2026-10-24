// @vitest-environment jsdom

import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@acme/ui/popover";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

test.each(["button", "span"])(
  "%s popover triggers expose semantics and open with the keyboard",
  async (kind) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(() =>
        root.render(
          <Popover>
            <PopoverTrigger
              render={kind === "span" ? <span /> : <button type="button" />}
            >
              Choose date
            </PopoverTrigger>
            <PopoverContent>
              <PopoverTitle>Date options</PopoverTitle>
            </PopoverContent>
          </Popover>,
        ),
      );
      const trigger = container.querySelector<HTMLElement>(
        "[data-slot=popover-trigger]",
      );
      expect(trigger?.tagName).toBe(kind.toUpperCase());
      expect(trigger?.getAttribute("aria-haspopup")).toBe("dialog");
      if (kind === "span") expect(trigger?.getAttribute("role")).toBe("button");
      trigger?.focus();
      await act(() => {
        trigger?.dispatchEvent(
          new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
        );
        if (kind === "button") trigger?.click();
      });
      expect(trigger?.getAttribute("aria-expanded")).toBe("true");
      expect(document.body.textContent).toContain("Date options");
    } finally {
      await act(() => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
    }
  },
);
