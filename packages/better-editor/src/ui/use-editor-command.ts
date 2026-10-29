"use client";

import type { Editor } from "@tiptap/core";
import { useCallback } from "react";
import type { EditorCommand } from "../engine/actions";
import {
  useEditorActionError,
  useEditorInstance,
  useEditorSelector,
} from "./editor-root";

/** Shared command behavior for custom buttons, menu items, and other presentations. */
export function useEditorCommand(command: EditorCommand, explicit?: Editor) {
  const editor = useEditorInstance(explicit);
  const onActionError = useEditorActionError();
  const state = useEditorSelector(
    (instance) => ({
      active: command.isActive?.(instance),
      disabled: !instance.isEditable || !(command.canRun?.(instance) ?? true),
    }),
    editor,
  );
  const run = useCallback(() => {
    if (
      !editor ||
      editor.isDestroyed ||
      !editor.isEditable ||
      !(command.canRun?.(editor) ?? true)
    )
      return false;
    try {
      command.run(editor);
      editor.view.focus();
      return true;
    } catch (error) {
      if (onActionError) onActionError(error);
      else throw error;
      return false;
    }
  }, [editor, command, onActionError]);
  return {
    active: state?.active,
    disabled: !editor || (state?.disabled ?? true),
    editor,
    run,
  };
}
