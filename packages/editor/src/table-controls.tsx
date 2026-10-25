"use client";

import type { TableAxis } from "@acme/tiptap";
import type { Editor } from "@tiptap/core";
import { EditorMenuItem } from "./controls";
import { tableMenuActions } from "./table-actions";
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "./ui-components";

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
