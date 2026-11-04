import type { Editor } from "@tiptap/core";
import { useCallback, useSyncExternalStore } from "react";
import { editorEditability } from "./editor-editability";

/** Observe option-only readonly changes and destruction without content rerenders. */
export function useEditorEditable(editor: Editor | undefined) {
  const store = editor ? editorEditability(editor) : undefined;
  const subscribe = useCallback(
    (notify: () => void) => store?.subscribe(notify) ?? (() => {}),
    [store],
  );
  return useSyncExternalStore(
    subscribe,
    () => Boolean(editor && !editor.isDestroyed && store?.snapshot()),
    () => false,
  );
}
