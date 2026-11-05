"use client";

import {
  canIndentBlock,
  duplicateSelectedBlock,
  indentBlock,
  selectedBlock,
} from "@acme/better-editor/engine/commands";
import { createEditorId } from "@acme/better-editor/engine/id";
import { blockAt } from "@acme/better-editor/engine/identity";
import {
  moveSelectedBlock,
  removeSelectedBlock,
} from "@acme/better-editor/engine/writing";
import { EditorMenuItem } from "@acme/better-editor/ui/controls";
import { useEditorSelector } from "@acme/better-editor/ui/editor-root";
import { useEditorEditable } from "@acme/better-editor/ui/use-editor-editable";
import { DropdownMenuSeparator } from "@acme/ui/dropdown-menu";
import type { Editor } from "@tiptap/core";
import { redo, undo } from "@tiptap/pm/history";
import { NodeSelection } from "@tiptap/pm/state";
import { Redo2, Undo2 } from "lucide-react";
import { copyTextToClipboard } from "~/lib/clipboard";
import type { DocumentEditorServices } from "./document-editor-services";

function targetBlockState(base: Editor["state"], blockId?: string) {
  if (!blockId) return base;
  try {
    const target = blockAt(base.doc, blockId);
    return base.apply(
      base.tr.setSelection(NodeSelection.create(base.doc, target.pos)),
    );
  } catch {
    return null;
  }
}

export function BlockActions({
  editor,
  blockId,
  services = {},
  includeFormatting = true,
  includeCopyLink = true,
  includeDelete = true,
}: {
  editor: Editor;
  blockId?: string;
  services?: DocumentEditorServices;
  includeFormatting?: boolean;
  includeCopyLink?: boolean;
  includeDelete?: boolean;
}) {
  const editable = useEditorEditable(editor);
  const capabilities = useEditorSelector((instance) => {
    const state = targetBlockState(instance.state, blockId);
    return {
      indent: Boolean(instance.isEditable && state && canIndentBlock(state)),
      outdent: Boolean(
        instance.isEditable && state && canIndentBlock(state, true),
      ),
      present: Boolean(state),
      redo: instance.isEditable && redo(instance.state),
      table:
        state && selectedBlock(state)?.node.firstChild?.type.name === "table",
      undo: instance.isEditable && undo(instance.state),
    };
  }, editor);
  const targetState = () => targetBlockState(editor.state, blockId);
  const execute = (
    command: (
      state: Editor["state"],
    ) => import("@tiptap/pm/state").Transaction | null,
  ) => {
    const target = targetState();
    if (editor.isDestroyed || !editor.isEditable || !target) return;
    const tr = command(target);
    if (tr) editor.view.dispatch(tr.scrollIntoView());
    editor.view.focus();
  };
  if (!capabilities?.present) return null;
  const run = (direction?: -1 | 1) =>
    execute((state) =>
      direction
        ? moveSelectedBlock(state, direction)
        : removeSelectedBlock(state, () => createEditorId()),
    );
  return (
    <>
      {includeFormatting && (
        <>
          <EditorMenuItem
            hint="Indent (Tab)"
            disabled={!editable || !capabilities.indent}
            onClick={() => execute((state) => indentBlock(state))}
          >
            Indent
          </EditorMenuItem>
          <EditorMenuItem
            hint="Outdent (Shift+Tab)"
            disabled={!editable || !capabilities.outdent}
            onClick={() => execute((state) => indentBlock(state, true))}
          >
            Outdent
          </EditorMenuItem>
          <DropdownMenuSeparator />
        </>
      )}
      <EditorMenuItem
        hint="Duplicate (⌘/Ctrl+D)"
        onClick={() =>
          execute((state) =>
            duplicateSelectedBlock(state, () => createEditorId()),
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
      {includeCopyLink && (
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
              await copyTextToClipboard(url);
            } catch (error) {
              services.onActionError?.(error);
            }
          }}
        >
          Copy block link
        </EditorMenuItem>
      )}
      {includeDelete && (
        <EditorMenuItem
          hint="Delete block and children"
          variant="destructive"
          onClick={() => run()}
        >
          {capabilities.table ? "Delete table" : "Delete block"}
        </EditorMenuItem>
      )}
      <DropdownMenuSeparator />
      <EditorMenuItem
        hint="Undo (⌘/Ctrl+Z)"
        disabled={!editable || !capabilities.undo}
        onClick={() => {
          if (editor.isDestroyed || !editor.isEditable) return;
          undo(editor.state, editor.view.dispatch);
          editor.view.focus();
        }}
      >
        <Undo2 />
        Undo
      </EditorMenuItem>
      <EditorMenuItem
        hint="Redo (⌘/Ctrl+Shift+Z)"
        disabled={!editable || !capabilities.redo}
        onClick={() => {
          if (editor.isDestroyed || !editor.isEditable) return;
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
