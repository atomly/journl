"use client";

import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@acme/ui/dropdown-menu";
import type { Editor } from "@tiptap/core";
import type { TableAxis } from "../engine/table-actions";
import { EditorMenuItem } from "./controls";
import { tableMenuActions } from "./table-actions";

export function TableMenuItems({
  editor,
  axis,
}: {
  editor: Editor;
  axis?: TableAxis;
}) {
  const actions = tableMenuActions(editor, axis);
  if (!actions.length) return null;
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Table</DropdownMenuLabel>
      {actions.map(({ label, hint, disabled, run }) => (
        <EditorMenuItem
          key={label}
          hint={hint}
          disabled={disabled}
          onClick={run}
        >
          {label}
        </EditorMenuItem>
      ))}
      <DropdownMenuSeparator />
    </DropdownMenuGroup>
  );
}
