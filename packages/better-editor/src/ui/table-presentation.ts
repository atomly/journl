import type { NodeViewRendererProps } from "@tiptap/core";
import { TableView } from "@tiptap/pm/tables";
import { tableExtensions } from "../engine/table-schema";
import { TABLE_DEFAULT_COLUMN_WIDTH } from "../engine/tables";

/** Optional table DOM layout, separate from table schema and editing behavior. */
export function tablePresentationExtensions() {
  return tableExtensions()
    .filter((extension) => extension.name === "table")
    .map((extension) =>
      extension.extend({
        addNodeView:
          () =>
          ({ node }: NodeViewRendererProps) => {
            const view = new TableView(node, TABLE_DEFAULT_COLUMN_WIDTH);
            view.dom.classList.add("better-editor-table-wrapper");
            view.table.dataset.betterEditorBody = "table";
            return view;
          },
      }),
    );
}
