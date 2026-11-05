import type { Editor } from "@tiptap/core";

const stores = new WeakMap<Editor, ReturnType<typeof createStore>>();
function createStore(editor: Editor) {
  // DOM node views subscribe while EditorView is still being constructed.
  // Tiptap's isDestroyed is true until that view is assigned; it is not a
  // terminal lifecycle signal here. Only the destroy event sets this latch.
  let destroyed = false;
  let previous = !editor.isDestroyed && editor.isEditable;
  const listeners = new Set<() => void>();
  const snapshot = () => !destroyed && !editor.isDestroyed && editor.isEditable;
  const update = () => {
    const next = snapshot();
    if (previous === next) return;
    previous = next;
    for (const listener of listeners) listener();
  };
  const destroy = () => {
    destroyed = true;
    update();
  };
  return {
    snapshot,
    subscribe(notify: () => void) {
      if (!listeners.size) {
        previous = snapshot();
        editor.on("update", update);
        editor.on("mount", update);
        editor.on("unmount", update);
        editor.on("destroy", destroy);
      }
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
        if (!listeners.size) {
          editor.off("update", update);
          editor.off("mount", update);
          editor.off("unmount", update);
          editor.off("destroy", destroy);
        }
      };
    },
  };
}
/** One editor listener; content updates do not notify presentation subscribers. */
export function editorEditability(editor: Editor) {
  let store = stores.get(editor);
  if (!store) {
    store = createStore(editor);
    stores.set(editor, store);
  }
  return store;
}
