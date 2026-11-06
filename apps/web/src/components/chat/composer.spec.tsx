// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  ComposerReasoning,
  ComposerReasoningContent,
  ComposerReasoningTrigger,
} from "~/components/chat/composer-context";
import { ComposerSources } from "~/components/chat/composer-selection";

const fixture = vi.hoisted(() => ({
  listeners: new Set<() => void>(),
  reasoning: "instant" as "instant" | "thinking",
  revision: 0,
  setReasoning: vi.fn(),
  text: "Selected writing",
}));
vi.mock("~/components/chat/chat-presentation", () => ({
  useChatActions: () => ({ exceeded: false }),
}));
vi.mock("~/hooks/use-journl-agent", () => ({
  useJournlAgent: () => ({
    getReasoning: () => fixture.reasoning,
    getRevision: () => fixture.revision,
    getSelections: () => (fixture.text ? [{ text: fixture.text }] : []),
    setReasoning: fixture.setReasoning,
    subscribe: (listener: () => void) => {
      fixture.listeners.add(listener);
      return () => {
        fixture.listeners.delete(listener);
      };
    },
  }),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  fixture.setReasoning.mockReset();
  fixture.reasoning = "instant";
  fixture.setReasoning.mockImplementation((value: "instant" | "thinking") => {
    fixture.reasoning = value;
    for (const listener of fixture.listeners) listener();
  });
  fixture.text = "Selected writing";
  fixture.revision = 0;
  fixture.listeners.clear();
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
  expect(trigger?.querySelector("[data-slot=select-value]")?.textContent).toBe(
    "Thinking",
  );
});

test("chat context follows the current highlighted selection without a second selection store", async () => {
  await act(async () => root.render(<ComposerSources />));
  expect(container.textContent).toContain("Selected writing");
  expect(container.querySelector("button")).toBeNull();
  await act(async () => {
    fixture.text = "Updated selection";
    fixture.revision++;
    for (const listener of fixture.listeners) listener();
  });
  expect(container.textContent).toContain("Updated selection");
  expect(container.textContent).not.toContain("Selected writing");
  await act(async () => {
    fixture.text = "";
    fixture.revision++;
    for (const listener of fixture.listeners) listener();
  });
  expect(container.textContent).toBe("");
});
