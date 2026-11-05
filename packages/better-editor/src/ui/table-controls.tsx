"use client";

import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@acme/ui/dropdown-menu";
import type { Editor } from "@tiptap/core";
import { selectedBlock } from "../engine/commands";
import type { TableAxis } from "../engine/table-actions";
import { EditorMenuItem } from "./controls";
import { useEditorSelector } from "./editor-root";
import { tableMenuActions } from "./table-actions";
import { useEditorEditable } from "./use-editor-editable";

export function TableMenuItems({
  editor,
  axis,
}: {
  editor: Editor;
  axis?: TableAxis;
}) {
  const editable = useEditorEditable(editor);
  useEditorSelector(
    (instance) => ({
      selection: instance.state.selection,
      table: selectedBlock(instance.state)?.node.firstChild,
    }),
    editor,
    (a, b) =>
      a === b ||
      Boolean(a && b && a.table === b.table && a.selection.eq(b.selection)),
  );
  const actions = tableMenuActions(editor, axis);
  if (!actions.length) return null;
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Table</DropdownMenuLabel>
      {actions.map(({ label, hint, disabled, run }) => (
        <EditorMenuItem
          key={label}
          hint={hint}
          disabled={disabled || !editable}
          onClick={run}
        >
          {label}
        </EditorMenuItem>
      ))}
      <DropdownMenuSeparator />
    </DropdownMenuGroup>
  );
}
