// @vitest-environment jsdom

import { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";
import { documentExtensions } from "../engine/schema";
import { toTiptapDocument } from "../serialization/tiptap";
import { TouchBlockDrag } from "./touch-block-drag";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

for (const ending of ["touchend", "touchcancel"] as const) {
  test(`release during activation completes cleanup (${ending})`, async () => {
    const surface = document.createElement("div");
    const host = document.createElement("div");
    document.body.append(surface, host);
    const editor = new Editor({
      content: toTiptapDocument([
        { content: "First", id: "first", type: "paragraph" },
      ]).toJSON(),
      element: surface,
      extensions: documentExtensions(),
    });
    const root = createRoot(host);
    const activity: boolean[] = [];
    const touch = (type: string, x: number) => {
      const button = host.querySelector("button");
      if (!button) throw new Error("Missing grip");
      const point = {
        clientX: x,
        clientY: 10,
        identifier: 1,
        pageX: x,
        pageY: 10,
        target: button,
      };
      const event = new TouchEvent(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        changedTouches: { value: [point] },
        touches: {
          value: type === "touchstart" || type === "touchmove" ? [point] : [],
        },
      });
      button.dispatchEvent(event);
    };
    try {
      await act(async () =>
        root.render(
          <TouchBlockDrag
            editor={editor}
            id="first"
            select={() =>
              editor.view.dispatch(
                editor.state.tr.setSelection(
                  NodeSelection.create(editor.state.doc, 0),
                ),
              )
            }
            onActiveChange={(active) => activity.push(active)}
          >
            {(handle) => (
              <button
                type="button"
                ref={handle.setActivatorNodeRef}
                {...handle.attributes}
                {...handle.listeners}
              >
                Move
              </button>
            )}
          </TouchBlockDrag>,
        ),
      );
      for (let attempt = 0; attempt < 2; attempt++) {
        await act(async () => touch("touchstart", 10));
        // No paint or assertion between crossing the threshold and release.
        await act(async () => {
          touch("touchmove", 30);
          touch(ending, 30);
        });
        expect(activity).toEqual(
          Array.from({ length: attempt + 1 }, () => [true, false]).flat(),
        );
        expect(
          host.querySelector("button")?.getAttribute("aria-pressed"),
        ).not.toBe("true");
        expect(editor.view.dragging).toBeNull();
        expect(editor.state.doc.textContent).toBe("First");
      }
      await act(async () => {
        touch("touchstart", 10);
        touch("touchmove", 30);
        touch(ending, 30);
        // The next plain tap must not inherit the completed drag's context.
        touch("touchstart", 10);
        touch("touchend", 10);
      });
      expect(activity).toEqual([true, false, true, false, true, false]);
    } finally {
      await act(async () => root.unmount());
      editor.destroy();
      surface.remove();
      host.remove();
    }
  });
}
