// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  ComposerReasoning,
  ComposerReasoningContent,
  ComposerReasoningTrigger,
} from "~/components/assistant-ui/thread-context";
import { ComposerSources } from "~/components/assistant-ui/thread-sources";

const fixture = vi.hoisted(() => ({
  setReasoning: vi.fn(),
  unsetSelection: vi.fn(),
}));
vi.mock("~/components/assistant-ui/thread-runtime", () => ({
  useThreadRuntime: () => ({ exceeded: false }),
}));
vi.mock("~/hooks/use-journl-agent", () => ({
  useJournlAgent: () => ({
    getReasoning: () => "instant",
    getSelections: () =>
      Array.from({ length: 5 }, (_, index) => ({
        blockIds: new Set([`block-${index}`]),
        text: `Selection ${index}`,
      })),
    setReasoning: fixture.setReasoning,
    unsetSelection: fixture.unsetSelection,
  }),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  fixture.setReasoning.mockReset();
  fixture.unsetSelection.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

test("reasoning mode shows its label before opening and changes on selection", async () => {
  await act(async () => {
    root.render(
      <ComposerReasoning>
        <ComposerReasoningTrigger />
        <ComposerReasoningContent />
      </ComposerReasoning>,
    );
  });
  const trigger = container.querySelector<HTMLButtonElement>("[role=combobox]");
  expect(trigger?.querySelector("[data-slot=select-value]")?.textContent).toBe(
    "Instant",
  );
  await act(async () => trigger?.click());
  const option = Array.from(
    document.querySelectorAll<HTMLElement>("[role=option]"),
  ).find((element) => element.textContent === "Thinking");
  expect(option).toBeDefined();
  await act(async () => option?.click());
  expect(fixture.setReasoning).toHaveBeenCalledExactlyOnceWith("thinking");
});

test.each(["click", "Enter"])(
  "removing an overflow selection via %s keeps the menu open",
  async (activation) => {
    await act(async () => root.render(<ComposerSources />));
    expect(container.querySelector("button button")).toBeNull();
    const trigger = container.querySelector<HTMLButtonElement>(
      "[data-slot=dropdown-menu-trigger]",
    );
    expect(trigger).not.toBeNull();
    await act(async () => trigger?.click());
    const item = Array.from(
      document.querySelectorAll<HTMLElement>("[role=menuitem]"),
    ).find((element) => element.textContent?.includes("Selection 3"));
    expect(item).toBeDefined();
    await act(async () => {
      if (activation === "click") item?.click();
      else {
        item?.focus();
        item?.dispatchEvent(
          new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
        );
      }
    });
    expect(fixture.unsetSelection).toHaveBeenCalledExactlyOnceWith({
      blockIds: new Set(["block-3"]),
      text: "Selection 3",
    });
    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector("[role=menu]")).not.toBeNull();
  },
);
