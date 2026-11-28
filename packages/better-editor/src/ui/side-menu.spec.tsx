// @vitest-environment jsdom

import { Editor } from "@tiptap/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { toTiptapDocument } from "../serialization/tiptap";
import { testDocumentExtensions } from "../testing/extensions";
import { TiptapSideMenu } from "./side-menu";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test.each(["pointerup", "pointercancel"] as const)(
  "another pointer's %s does not finish a block-handle press",
  async (ending) => {
    vi.stubGlobal("matchMedia", () => ({
      addEventListener() {},
      matches: false,
      removeEventListener() {},
    }));
    const surface = document.createElement("div");
    const host = document.createElement("div");
    document.body.append(surface, host);
    const editor = new Editor({
      content: toTiptapDocument([
        { content: "Alpha", id: "alpha", type: "paragraph" },
      ]).toJSON(),
      element: surface,
      extensions: testDocumentExtensions(),
    });
    const root = createRoot(host);
    const pointer = (target: EventTarget, type: string, pointerId: number) => {
      target.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          isPrimary: true,
          pointerId,
          pointerType: "mouse",
        }),
      );
    };
    try {
      await act(async () =>
        root.render(
          <TiptapSideMenu
            editor={editor}
            renderMenu={() => <span>Block menu contents</span>}
            visible
          />,
        ),
      );
      await act(async () => editor.commands.setTextSelection(3));
      const handle = document.querySelector('[aria-label="Block actions"]');
      if (!handle) throw new Error("Missing block handle");

      await act(async () => pointer(handle, "pointerdown", 1));
      await act(async () => pointer(document.body, ending, 2));
      expect(document.body.textContent).not.toContain("Block menu contents");
      await act(async () => pointer(handle, "pointerup", 1));
      expect(document.body.textContent).toContain("Block menu contents");
    } finally {
      await act(async () => root.unmount());
      editor.destroy();
      surface.remove();
      host.remove();
      vi.unstubAllGlobals();
    }
  },
);
