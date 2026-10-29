// @vitest-environment jsdom
import { parseBlock } from "@acme/document";
import { Editor } from "@tiptap/core";
import { expect, test, vi } from "vitest";
import { documentExtensions } from "../engine/schema";
import { toTiptapDocument } from "../serialization/tiptap";
import { revealTableColumn } from "./table-reveal";

for (const unmergedRow of [true, false]) {
  test.each([false, true])(
    `column reveal measures a column within a wide span (${unmergedRow ? "unmerged row" : "all merged"}; popup scroll reset: %s)`,
    (popupFocus) => {
      const merged = { content: [], props: { colspan: 9 }, type: "tableCell" };
      const editor = new Editor({
        content: toTiptapDocument([
          parseBlock({
            content: {
              columnWidths: Array(9).fill(120),
              rows: [
                { cells: [merged] },
                {
                  cells: unmergedRow
                    ? Array(9).fill({ content: [], type: "tableCell" })
                    : [merged],
                },
              ],
              type: "tableContent",
            },
            id: "table",
            type: "table",
          }),
        ]).toJSON(),
        element: document.createElement("div"),
        extensions: documentExtensions(),
      });
      const frames: FrameRequestCallback[] = [];
      vi.stubGlobal(
        "requestAnimationFrame",
        (callback: FrameRequestCallback) => {
          frames.push(callback);
          return frames.length;
        },
      );
      const frame = () => {
        for (const callback of frames.splice(0)) callback(0);
      };
      const table = editor.view.dom.querySelector("table");
      if (!table?.parentElement) throw new Error("Missing table view");
      const wrapper = table.parentElement;
      wrapper.classList.add("better-editor-table-wrapper");
      Object.defineProperty(wrapper, "clientWidth", {
        configurable: true,
        value: 360,
      });
      vi.spyOn(wrapper, "getBoundingClientRect").mockReturnValue(
        new DOMRect(0, 0, 360, 100),
      );
      for (const row of table.rows) {
        let column = 0;
        for (const cell of row.cells) {
          const left = column * 120;
          const width = cell.colSpan * 120;
          vi.spyOn(cell, "getBoundingClientRect").mockImplementation(
            () => new DOMRect(left - wrapper.scrollLeft, 0, width, 30),
          );
          column += cell.colSpan;
        }
      }
      try {
        for (const [column, expected] of [
          [7, 600],
          [1, 120],
        ] as const) {
          wrapper.scrollLeft = 480;
          revealTableColumn(editor, "table", column);
          if (popupFocus)
            requestAnimationFrame(() =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => {
                  wrapper.scrollLeft = 480;
                }),
              ),
            );
          for (let tick = 0; tick < 10; tick++) frame();
          expect(wrapper.scrollLeft).toBe(expected);
          expect(wrapper.scrollTop).toBe(0);
        }
        // A column wider than the viewport must not oscillate between edges.
        Object.defineProperty(wrapper, "clientWidth", { value: 80 });
        wrapper.scrollLeft = 0;
        revealTableColumn(editor, "table", 7);
        for (let tick = 0; tick < 10; tick++) frame();
        expect(wrapper.scrollLeft).toBe(840);
        Object.defineProperty(wrapper, "clientWidth", { value: 360 });

        // A new user gesture owns scrolling immediately, even before layout.
        for (const event of ["pointerdown", "keydown", "wheel", "touchstart"]) {
          wrapper.scrollLeft = 480;
          revealTableColumn(editor, "table", 7);
          editor.view.dom.dispatchEvent(new Event(event, { bubbles: true }));
          for (let tick = 0; tick < 10; tick++) frame();
          expect(wrapper.scrollLeft).toBe(480);
        }
        // A removed/replaced document invalidates an earlier layout callback.
        wrapper.scrollLeft = 480;
        revealTableColumn(editor, "table", 7);
        editor.commands.clearContent();
        for (let tick = 0; tick < 10; tick++) frame();
        expect(wrapper.scrollLeft).toBe(480);
      } finally {
        editor.destroy();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
      }
    },
  );
}
