"use client";

import {
  canIndentBlock,
  duplicateSelectedBlock,
  indentBlock,
  selectedBlock,
} from "@acme/better-editor/engine/commands";
import { blockAt } from "@acme/better-editor/engine/identity";
import {
  moveSelectedBlock,
  removeSelectedBlock,
} from "@acme/better-editor/engine/writing";
import { EditorMenuItem } from "@acme/better-editor/ui/controls";
import { useEditorSelector } from "@acme/better-editor/ui/editor-root";
import { DropdownMenuSeparator } from "@acme/ui/dropdown-menu";
import type { Editor } from "@tiptap/core";
import { redo, undo } from "@tiptap/pm/history";
import { NodeSelection } from "@tiptap/pm/state";
import { Redo2, Undo2 } from "lucide-react";
import type { DocumentEditorServices } from "./document-editor-services";

export function BlockActions({
  editor,
  blockId,
  services = {},
}: {
  editor: Editor;
  blockId?: string;
  services?: DocumentEditorServices;
}) {
  const current =
    useEditorSelector((instance) => instance.state, editor, Object.is) ??
    editor.state;
  const targetState = (base = editor.state) => {
    if (!blockId) return base;
    try {
      const target = blockAt(base.doc, blockId);
      return base.apply(
        base.tr.setSelection(NodeSelection.create(base.doc, target.pos)),
      );
    } catch {
      return null;
    }
  };
  const execute = (
    command: (
      state: Editor["state"],
    ) => import("@tiptap/pm/state").Transaction | null,
  ) => {
    const target = targetState();
    if (!target) return;
    const tr = command(target);
    if (tr) editor.view.dispatch(tr.scrollIntoView());
    editor.view.focus();
  };
  const state = targetState(current);
  if (!state) return null;
  const run = (direction?: -1 | 1) =>
    execute((state) =>
      direction
        ? moveSelectedBlock(state, direction)
        : removeSelectedBlock(state, () => crypto.randomUUID()),
    );
  return (
    <>
      <EditorMenuItem
        hint="Indent (Tab)"
        disabled={!canIndentBlock(state)}
        onClick={() => execute((state) => indentBlock(state))}
      >
        Indent
      </EditorMenuItem>
      <EditorMenuItem
        hint="Outdent (Shift+Tab)"
        disabled={!canIndentBlock(state, true)}
        onClick={() => execute((state) => indentBlock(state, true))}
      >
        Outdent
      </EditorMenuItem>
      <DropdownMenuSeparator />
      <EditorMenuItem
        hint="Duplicate (⌘/Ctrl+D)"
        onClick={() =>
          execute((state) =>
            duplicateSelectedBlock(state, () => crypto.randomUUID()),
          )
        }
      >
        Duplicate block
      </EditorMenuItem>
      <EditorMenuItem hint="Move up (⌘/Ctrl+Shift+↑)" onClick={() => run(-1)}>
        Move block up
      </EditorMenuItem>
      <EditorMenuItem hint="Move down (⌘/Ctrl+Shift+↓)" onClick={() => run(1)}>
        Move block down
      </EditorMenuItem>
      <EditorMenuItem
        hint="Copy block link"
        disabled={!services.getBlockUrl}
        onClick={async () => {
          const target = targetState();
          const id = target && selectedBlock(target)?.id;
          if (!id) return;
          const url = services.getBlockUrl?.(id);
          if (!url) return;
          try {
            await navigator.clipboard.writeText(url);
          } catch (error) {
            services.onActionError?.(error);
          }
        }}
      >
        Copy block link
      </EditorMenuItem>
      <EditorMenuItem
        hint="Delete block and children"
        variant="destructive"
        onClick={() => run()}
      >
        {selectedBlock(state)?.node.firstChild?.type.name === "table"
          ? "Delete table"
          : "Delete block"}
      </EditorMenuItem>
      <DropdownMenuSeparator />
      <EditorMenuItem
        hint="Undo (⌘/Ctrl+Z)"
        disabled={!undo(editor.state)}
        onClick={() => {
          undo(editor.state, editor.view.dispatch);
          editor.view.focus();
        }}
      >
        <Undo2 />
        Undo
      </EditorMenuItem>
      <EditorMenuItem
        hint="Redo (⌘/Ctrl+Shift+Z)"
        disabled={!redo(editor.state)}
        onClick={() => {
          redo(editor.state, editor.view.dispatch);
          editor.view.focus();
        }}
      >
        <Redo2 />
        Redo
      </EditorMenuItem>
    </>
  );
}
