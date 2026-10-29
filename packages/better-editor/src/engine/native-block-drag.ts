import { type Editor, Extension, isMacOS } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import {
  NodeSelection,
  Plugin,
  PluginKey,
  type SelectionBookmark,
} from "@tiptap/pm/state";
import { dropPoint } from "@tiptap/pm/transform";
import { selectedBlocks } from "./commands";
import { blockAt, copySlice } from "./identity";

export const BLOCK_DRAG_MIME = "application/x-better-editor-block-drag";
type Session = {
  token: string;
  bookmark: SelectionBookmark;
  ids: string[];
  valid: boolean;
};
const key = new PluginKey<Session | null>("better-editor-native-block-drag");

export function nativeBlockDragActive(editor: Editor): boolean {
  return Boolean(key.getState(editor.state));
}

/** Capture the source independently of focus, live selection, and view.dragging. */
export function beginNativeBlockDrag(
  editor: Editor,
  transfer: DataTransfer,
): boolean {
  if (!editor.isEditable || key.getState(editor.state) === undefined)
    return false;
  const session: Session = {
    bookmark: editor.state.selection.getBookmark(),
    ids: selectedBlocks(editor.state).map(({ id }) => id),
    token: crypto.randomUUID(),
    valid: true,
  };
  if (!session.ids.length) return false;
  transfer.setData(
    BLOCK_DRAG_MIME,
    JSON.stringify({ owner: editor.instanceId, token: session.token }),
  );
  editor.view.dispatch(editor.state.tr.setMeta(key, session));
  return true;
}

export const nativeBlockDragExtension = Extension.create({
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin<Session | null>({
        key,
        props: {
          handleDOMEvents: {
            drop(view, event) {
              const raw = event.dataTransfer?.getData(BLOCK_DRAG_MIME);
              if (!raw) return false;
              let payload: { owner?: unknown; token?: unknown };
              try {
                payload = JSON.parse(raw);
              } catch {
                return false;
              }
              if (!payload || payload.owner !== editor.instanceId) return false;
              // An owned gesture must never fall back to importing its clipboard copy.
              event.preventDefault();
              const session = key.getState(view.state);
              const cancel = () =>
                view.dispatch(view.state.tr.setMeta(key, null));
              view.dragging = null;
              if (
                !view.editable ||
                !session?.valid ||
                session.token !== payload.token
              ) {
                cancel();
                return true;
              }
              const target = view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              });
              if (!target) {
                cancel();
                return true;
              }
              try {
                const selection = session.bookmark.resolve(view.state.doc);
                if (
                  !session.ids.length ||
                  session.ids.some((id) => {
                    const source = blockAt(view.state.doc, id);
                    return (
                      source.pos < selection.from ||
                      source.pos + source.node.nodeSize > selection.to
                    );
                  })
                ) {
                  cancel();
                  return true;
                }
                const copy = isMacOS() ? event.altKey : event.ctrlKey;
                if (
                  !copy &&
                  target.pos >= selection.from &&
                  target.pos <= selection.to
                ) {
                  cancel();
                  return true;
                }
                const source = selection.content();
                const slice = copy
                  ? copySlice(source, () => crypto.randomUUID())
                  : source;
                // Whole blocks use the target row's vertical half, not the
                // horizontal caret position inside its text. This matches the
                // touch path and makes moving back above a paragraph stable.
                const resolved = view.state.doc.resolve(target.pos);
                let depth = resolved.depth;
                while (
                  depth > 0 &&
                  resolved.node(depth).type.name !== "betterEditorBlock"
                )
                  depth--;
                const rowPos = depth > 0 ? resolved.before(depth) : target.pos;
                const row = view.state.doc.nodeAt(rowPos);
                const dom =
                  row?.type.name === "betterEditorBlock"
                    ? view.nodeDOM(rowPos)
                    : null;
                const surface =
                  dom instanceof Element
                    ? (dom.querySelector("[data-better-editor-body]") ?? dom)
                    : null;
                const rect = surface?.getBoundingClientRect();
                const destination =
                  rect && rect.height > 0 && row
                    ? rowPos +
                      (event.clientY >= rect.top + rect.height / 2
                        ? row.nodeSize
                        : 0)
                    : dropPoint(view.state.doc, target.pos, slice);
                if (destination === null) {
                  cancel();
                  return true;
                }
                const tr = closeHistory(view.state.tr).setMeta(key, null);
                if (!copy) tr.delete(selection.from, selection.to);
                const pos = tr.mapping.map(destination);
                tr.replaceRange(pos, pos, slice);
                tr.setSelection(NodeSelection.create(tr.doc, pos));
                view.dispatch(tr.setMeta("uiEvent", "drop").scrollIntoView());
                view.dispatch(closeHistory(view.state.tr));
                view.focus();
              } catch {
                cancel();
              }
              return true;
            },
          },
        },
        state: {
          apply(tr, session) {
            const replacement = tr.getMeta(key);
            if (replacement !== undefined) return replacement;
            if (!session) return null;
            try {
              const before = session.bookmark.resolve(tr.before);
              return {
                ...session,
                bookmark: session.bookmark.map(tr.mapping),
                valid:
                  session.valid &&
                  tr.mapping.map(before.from, 1) <
                    tr.mapping.map(before.to, -1),
              };
            } catch {
              return { ...session, valid: false };
            }
          },
          init: () => null,
        },
        view(view) {
          const end = () => {
            if (!editor.isDestroyed && key.getState(view.state))
              view.dispatch(view.state.tr.setMeta(key, null));
          };
          view.dom.ownerDocument.addEventListener("dragend", end);
          return {
            destroy: () =>
              view.dom.ownerDocument.removeEventListener("dragend", end),
          };
        },
      }),
    ];
  },
  name: "better-editor-native-block-drag",
  priority: 2000,
});
