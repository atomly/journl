import { blockAt, tableColumnWidth } from "@acme/tiptap";
import type { Editor } from "@tiptap/core";
import { TableMap } from "@tiptap/pm/tables";

/** Reveal the added column without vertical scrolling. WebKit gives col
 * elements empty boxes, so use the narrowest cell covering this column. */
export function revealTableColumn(editor: Editor, id: string, column: number) {
  const doc = editor.state.doc;
  requestAnimationFrame(() => {
    // Undo, replacement or a newer edit invalidates this pending reveal.
    if (editor.isDestroyed || editor.state.doc !== doc) return;
    try {
      const target = blockAt(doc, id);
      const table = target.node.firstChild;
      if (!table) return;
      const map = TableMap.get(table);
      if (column < 0 || column >= map.width) return;
      let offset = map.map[column];
      if (offset === undefined) return;
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
      if (!(cell instanceof HTMLElement)) return;
      const wrapper = cell.closest<HTMLElement>(".better-editor-table-wrapper");
      if (!wrapper) return;
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
      wrapper.scrollLeft +=
        start < left ? start - left : Math.max(0, end - right);
    } catch {
      // The target may have disappeared before layout was measured.
    }
  });
}
