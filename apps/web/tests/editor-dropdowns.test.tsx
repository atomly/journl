// @vitest-environment jsdom

import { BlockNoteEditor } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/shadcn";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import * as Button from "../src/components/ui/button";
import * as DropdownMenu from "../src/components/ui/dropdown-menu";
import * as Popover from "../src/components/ui/popover";
import * as Select from "../src/components/ui/select";
import * as Toggle from "../src/components/ui/toggle";
import * as Tooltip from "../src/components/ui/tooltip";

test("the app's BlockNote heading dropdown stays inside editor focus and applies a heading", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const previousRect = Object.getOwnPropertyDescriptor(
    Range.prototype,
    "getBoundingClientRect",
  );
  const previousRects = Object.getOwnPropertyDescriptor(
    Range.prototype,
    "getClientRects",
  );
  const rectangle = new DOMRect(20, 20, 250, 30);
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => rectangle,
  });
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [rectangle],
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const editor = BlockNoteEditor.create({
    initialContent: [
      { content: "Select this paragraph.", id: "source", type: "paragraph" },
    ],
  });
  try {
    await act(async () => {
      root.render(
        <BlockNoteView
          editor={editor}
          shadCNComponents={{
            Button,
            DropdownMenu,
            Popover,
            Select,
            Toggle,
            Tooltip,
          }}
        />,
      );
    });
    await act(async () => {
      editor.focus();
      const view = editor.prosemirrorView;
      const Selection = view.state.selection
        .constructor as typeof import("@tiptap/pm/state").TextSelection;
      view.dispatch(
        view.state.tr.setSelection(Selection.create(view.state.doc, 3, 15)),
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    const trigger = container.querySelector<HTMLButtonElement>(
      "[data-slot=select-trigger]",
    );
    expect(trigger).not.toBeNull();
    await act(async () => {
      trigger?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    const popup = container.querySelector(
      ".bn-root [data-slot=select-content]",
    );
    expect(popup).not.toBeNull();
    expect(popup?.contains(document.activeElement)).toBe(true);
    expect(
      container.querySelector("[data-slot=select-trigger]"),
    ).not.toBeNull();
    const heading = Array.from(
      popup?.querySelectorAll<HTMLElement>("[role=option]") ?? [],
    ).find((item) => item.textContent === "Heading 2");
    expect(heading).toBeDefined();
    await act(async () => {
      heading?.click();
    });
    expect(editor.document[0]?.type).toBe("heading");
    expect(editor.document[0]?.props).toMatchObject({ level: 2 });
  } finally {
    await act(async () => root.unmount());
    container.remove();
    if (previousRect)
      Object.defineProperty(
        Range.prototype,
        "getBoundingClientRect",
        previousRect,
      );
    else Reflect.deleteProperty(Range.prototype, "getBoundingClientRect");
    if (previousRects)
      Object.defineProperty(Range.prototype, "getClientRects", previousRects);
    else Reflect.deleteProperty(Range.prototype, "getClientRects");
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
