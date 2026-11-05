import { type Editor, Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import type { NodeView } from "@tiptap/pm/view";

export type ReferenceView = {
  key: number;
  dom: HTMLElement;
  node: PMNode;
  getPos: () => number | undefined;
  editor: Editor;
};
/** Portals keep the app's query/router/theme context. Views never write content
 * while resolving previews; clipboard/storage still use the adapter's schema. */
export function referenceViewStore() {
  const views = new Map<number, ReferenceView>();
  let keys: readonly number[] = [];
  const viewListeners = new Map<number, Set<() => void>>();
  const notifyView = (id: number) => {
    for (const listener of viewListeners.get(id) ?? []) listener();
  };
  let key = 0;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const extension = Extension.create({
    addProseMirrorPlugins() {
      const editor = this.editor;
      const nodeViews = Object.fromEntries(
        ["contentReference", "referenceCard", "contentEmbed"].map((type) => [
          type,
          (
            node: PMNode,
            _view: import("@tiptap/pm/view").EditorView,
            getPos: () => number | undefined,
          ): NodeView => {
            const dom = document.createElement(
              type === "contentReference" ? "span" : "div",
            );
            dom.contentEditable = "false";
            if (type === "contentReference")
              dom.dataset.betterEditorReference = "";
            else dom.dataset.betterEditorBody = type;
            const id = key++;
            let current = node;
            const sync = (next: PMNode) => {
              current = next;
              dom.setAttribute(
                "data-better-editor-attrs",
                JSON.stringify(next.attrs),
              );
              const added = !views.has(id);
              views.set(id, { dom, editor, getPos, key: id, node: next });
              if (added) {
                keys = [...views.keys()];
                notify();
              } else notifyView(id);
            };
            sync(node);
            return {
              deselectNode: () =>
                dom.classList.remove("ProseMirror-selectednode"),
              destroy() {
                views.delete(id);
                keys = [...views.keys()];
                notifyView(id);
                notify();
              },
              dom,
              ignoreMutation: () => true,
              selectNode: () => dom.classList.add("ProseMirror-selectednode"),
              stopEvent: (event) =>
                event.target instanceof Element &&
                Boolean(event.target.closest('a,button,input,[role="menu"]')),
              update(next) {
                if (next.type !== node.type) return false;
                if (next !== current) sync(next);
                return true;
              },
            };
          },
        ]),
      );
      return [new Plugin({ props: { nodeViews } })];
    },
    name: "better-editor-presentation",
  });
  return {
    extension,
    getSnapshot: () => keys,
    getView: (id: number) => views.get(id),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    subscribeView: (id: number, listener: () => void) => {
      let subscribers = viewListeners.get(id);
      if (!subscribers) {
        subscribers = new Set();
        viewListeners.set(id, subscribers);
      }
      subscribers.add(listener);
      return () => {
        subscribers.delete(listener);
        if (!subscribers.size) viewListeners.delete(id);
      };
    },
  };
}
