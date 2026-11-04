"use client";

import { selectedBlock } from "@acme/better-editor/engine/commands";
import { createEditorId } from "@acme/better-editor/engine/id";
import {
  applyTableEdit,
  type TableAxis,
} from "@acme/better-editor/engine/table-actions";
import { removeSelectedBlock } from "@acme/better-editor/engine/writing";
import { EditorMenuItem } from "@acme/better-editor/ui/controls";
import { useEditorSelector } from "@acme/better-editor/ui/editor-root";
import {
  type TableMenuAction,
  tableMenuActions,
} from "@acme/better-editor/ui/table-actions";
import { useEditorEditable } from "@acme/better-editor/ui/use-editor-editable";
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@acme/ui/dropdown-menu";
import type { Editor } from "@tiptap/core";
import { CellSelection } from "@tiptap/pm/tables";

function Action({ action }: { action: TableMenuAction }) {
  return (
    <EditorMenuItem
      hint={action.hint}
      disabled={action.disabled}
      onClick={action.run}
      variant={action.label.startsWith("Delete") ? "destructive" : "default"}
    >
      {action.label}
    </EditorMenuItem>
  );
}

/** Journl chooses the menu layout. BetterEditor supplies current-state commands. */
export function DocumentTableMenu({
  editor,
  axis,
}: {
  editor: Editor;
  axis?: TableAxis;
}) {
  const editable = useEditorEditable(editor);
  const selected = useEditorSelector((instance) => {
    const block = selectedBlock(instance.state);
    return {
      body: block?.node.firstChild,
      id: block?.id,
      selection: instance.state.selection,
    };
  }, editor);
  if (selected?.body?.type.name !== "table") return null;
  const actions = tableMenuActions(editor, axis);
  const selection = selected.selection;
  const deletion =
    selection instanceof CellSelection
      ? selection.isRowSelection() && !selection.isColSelection()
        ? actions.find((action) => action.label === "Delete row")
        : selection.isColSelection() && !selection.isRowSelection()
          ? actions.find((action) => action.label === "Delete column")
          : undefined
      : undefined;
  const groups = [
    [
      "Rows",
      (action: TableMenuAction) =>
        /row/.test(action.label) && !/header/.test(action.label),
    ],
    [
      "Columns",
      (action: TableMenuAction) =>
        /column/.test(action.label) && !/header/.test(action.label),
    ],
    ["Cells", (action: TableMenuAction) => /cell/.test(action.label)],
    ["Headers", (action: TableMenuAction) => /header/.test(action.label)],
  ] as const;
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Table</DropdownMenuLabel>
      {axis ? (
        actions.map((action) => <Action key={action.label} action={action} />)
      ) : (
        <>
          {deletion && (
            <Action
              action={{
                ...deletion,
                label:
                  deletion.label === "Delete row"
                    ? "Delete selected rows"
                    : "Delete selected columns",
              }}
            />
          )}
          {groups.map(([label, accepts]) => {
            const entries = actions.filter(accepts);
            if (!entries.length) return null;
            return (
              <DropdownMenuSub key={label}>
                <DropdownMenuSubTrigger>{label}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  data-tiptap-controls=""
                  data-tiptap-owner={editor.instanceId}
                >
                  {entries.map((action) => (
                    <Action key={action.label} action={action} />
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            );
          })}
        </>
      )}
      <DropdownMenuSeparator />
      <EditorMenuItem
        hint="Remove the whole table and its content"
        variant="destructive"
        disabled={!editable}
        onClick={() => {
          if (editor.isDestroyed || !editor.isEditable) return;
          const current = selectedBlock(editor.state);
          if (
            current?.id !== selected.id ||
            current?.node.firstChild?.type.name !== "table"
          )
            return;
          const tr = removeSelectedBlock(editor.state, createEditorId);
          if (tr) applyTableEdit(editor, tr);
          editor.view.focus();
        }}
      >
        Delete table
      </EditorMenuItem>
      <DropdownMenuSeparator />
    </DropdownMenuGroup>
  );
}
