// @vitest-environment jsdom
import { parseBlock } from "@acme/document";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@acme/ui/dropdown-menu";
import { Editor } from "@tiptap/core";
import { CellSelection } from "@tiptap/pm/tables";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";
import { documentExtensions } from "../engine/schema";
import { tableContext } from "../engine/table-actions";
import { toTiptapDocument } from "../serialization/tiptap";
import { TableMenuItems } from "./table-controls";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test("independently composed table menus follow selection and editability without parent rerenders", async () => {
  const host = document.createElement("div");
  const surface = document.createElement("div");
  document.body.append(host, surface);
  const editor = new Editor({
    content: toTiptapDocument([
      parseBlock({
        content: {
          columnWidths: [100, 150],
          rows: [{ cells: ["A", "B"] }],
          type: "tableContent",
        },
        id: "table",
        type: "table",
      }),
    ]).toJSON(),
    element: surface,
    extensions: documentExtensions(),
  });
  const root = createRoot(host);
  let renders = 0;
  function Menu() {
    renders++;
    return (
      <DropdownMenu open modal={false}>
        <DropdownMenuTrigger>Table menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <TableMenuItems editor={editor} />
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  const item = (text: string) =>
    Array.from(document.querySelectorAll('[role="menuitem"]')).find((node) =>
      node.textContent?.includes(text),
    );
  try {
    await act(async () => root.render(<Menu />));
    const initialRenders = renders;
    expect(item("Merge cells")?.getAttribute("aria-disabled")).toBe("true");
    const context = tableContext(editor.state);
    if (!context) throw new Error("Missing table");
    const first = context.map.map[0];
    const last = context.map.map[1];
    if (first === undefined || last === undefined)
      throw new Error("Missing cells");
    await act(async () =>
      editor.view.dispatch(
        editor.state.tr.setSelection(
          CellSelection.create(
            editor.state.doc,
            context.start + first,
            context.start + last,
          ),
        ),
      ),
    );
    expect(item("Merge cells")?.getAttribute("aria-disabled")).not.toBe("true");
    // Keeping the head cell fixes from/to; changing only the anchor still changes capabilities.
    await act(async () =>
      editor.view.dispatch(
        editor.state.tr.setSelection(
          CellSelection.create(
            editor.state.doc,
            context.start + last,
            context.start + last,
          ),
        ),
      ),
    );
    expect(item("Merge cells")?.getAttribute("aria-disabled")).toBe("true");
    await act(async () => editor.setEditable(false));
    expect(item("Insert column right")?.getAttribute("aria-disabled")).toBe(
      "true",
    );
    await act(async () => editor.setEditable(true));
    expect(item("Insert column right")?.getAttribute("aria-disabled")).not.toBe(
      "true",
    );
    expect(renders).toBe(initialRenders);
  } finally {
    await act(async () => root.unmount());
    editor.destroy();
    host.remove();
    surface.remove();
  }
});
