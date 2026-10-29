import type { Editor } from "@tiptap/core";
import { useCallback, useRef, useSyncExternalStore } from "react";

/** setEditable emits update, not transaction; option-only changes need a listener. */
export function useEditorEditable(editor: Editor | undefined) {
  const destroyed = useRef<Editor | undefined>(undefined);
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!editor) return () => {};
      editor.on("update", notify);
      // Tiptap emits destroy before its view's isDestroyed flag changes.
      const destroy = () => {
        destroyed.current = editor;
        notify();
      };
      editor.on("destroy", destroy);
      return () => {
        editor.off("update", notify);
        editor.off("destroy", destroy);
      };
    },
    [editor],
  );
  return useSyncExternalStore(
    subscribe,
    () =>
      Boolean(
        editor &&
          destroyed.current !== editor &&
          !editor.isDestroyed &&
          editor.isEditable,
      ),
    () => false,
  );
}
