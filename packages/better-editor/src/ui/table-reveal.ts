import type { Editor } from "@tiptap/core";
import { TableMap } from "@tiptap/pm/tables";
import { blockAt } from "../engine/identity";
import { tableColumnWidth } from "../engine/table-actions";

/** Reveal the added column without vertical scrolling. WebKit gives col
 * elements empty boxes, so use the narrowest cell covering this column. */
export function revealTableColumn(editor: Editor, id: string, column: number) {
  if (editor.isDestroyed) return;
  const doc = editor.state.doc;
  const dom = editor.view.dom;
  const interrupts = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
  let frame = 0;
  let attempts = 0;
  let settled = 0;
  let cancelled = false;
  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    cancelAnimationFrame(frame);
    for (const event of interrupts)
      dom.removeEventListener(event, cancel, true);
    editor.off("destroy", cancel);
  };
  const measure = () => {
    if (cancelled) return;
    // Undo, replacement or a newer edit invalidates this pending reveal.
    if (editor.isDestroyed || editor.state.doc !== doc) return cancel();
    try {
      const target = blockAt(doc, id);
      const table = target.node.firstChild;
      if (!table) return cancel();
      const map = TableMap.get(table);
      if (column < 0 || column >= map.width) return cancel();
      let offset = map.map[column];
      if (offset === undefined) return cancel();
      let span = map.findCell(offset);
      for (let row = 1; row < map.height && span.right - span.left > 1; row++) {
        const candidate = map.map[row * map.width + column];
        if (candidate === undefined) continue;
        const rect = map.findCell(candidate);
        if (rect.right - rect.left < span.right - span.left) {
          offset = candidate;
          span = rect;
        }
      }
      const cell = editor.view.nodeDOM(target.pos + 2 + offset);
      if (!(cell instanceof HTMLElement)) return cancel();
      const wrapper = cell.closest<HTMLElement>(".better-editor-table-wrapper");
      if (!wrapper) return cancel();
      const bounds = cell.getBoundingClientRect();
      // If every row is merged here, apportion the rendered span using the
      // native table's column widths rather than revealing the entire span.
      const widths = Array.from({ length: span.right - span.left }, (_, i) =>
        tableColumnWidth(table, span.left + i),
      );
      const total = widths.reduce((sum, width) => sum + width, 0);
      const before = widths
        .slice(0, column - span.left)
        .reduce((sum, width) => sum + width, 0);
      const start = bounds.left + (bounds.width * before) / total;
      const end =
        start + (bounds.width * (widths[column - span.left] ?? 0)) / total;
      const left = wrapper.getBoundingClientRect().left + wrapper.clientLeft;
      const right = left + wrapper.clientWidth;
      const delta =
        end - start > right - left
          ? start > left
            ? start - left
            : Math.min(0, end - right)
          : start < left
            ? start - left
            : Math.max(0, end - right);
      if (Math.abs(delta) > 1) {
        wrapper.scrollLeft += delta;
        settled = 0;
      } else settled++;
      // Native popup-focus scrolling can follow our first layout measurement.
      // Wait for three stable frames, with a strict limit and fresh-input cancel.
      if (++attempts < 8 && settled < 3) frame = requestAnimationFrame(measure);
      else cancel();
    } catch {
      // The target may have disappeared before layout was measured.
      cancel();
    }
  };
  for (const event of interrupts)
    dom.addEventListener(event, cancel, { capture: true, passive: true });
  editor.on("destroy", cancel);
  frame = requestAnimationFrame(measure);
}
