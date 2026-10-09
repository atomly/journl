import { createExtension } from "@blocknote/core";
import { NodeSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/** Keep Tab available for normal focus traversal from controls inside node views. */
export function preserveControlTabNavigation(
  view: Pick<EditorView, "dom">,
  event: KeyboardEvent,
) {
  if (event.key !== "Tab" || !(event.target instanceof Element)) return false;
  const target = event.target;
  return (
    target !== view.dom &&
    !!target.closest(
      "button, input, select, textarea, a[href], [role='button'], [role='menuitem']",
    )
  );
}

// Tiptap node views stop keyboard events from their noneditable background before
// ProseMirror's keymaps run. Route only selected reference backgrounds through the
// same native shortcuts as editable content; their buttons keep browser traversal.
export const ReferenceTabNavigationExtension = createExtension(
  ({ editor }) => ({
    key: "referenceTabNavigation",
    mount({ dom, signal }) {
      dom.addEventListener(
        "keydown",
        (event) => {
          if (
            event.key !== "Tab" ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey ||
            event.defaultPrevented
          )
            return;
          const view = editor.prosemirrorView;
          if (
            !view ||
            preserveControlTabNavigation(view, event) ||
            !(event.target instanceof Element)
          )
            return;
          const background = event.target.closest(
            "[data-content-type='referenceCard'], [data-content-type='contentEmbed']",
          );
          if (!background || !(view.state.selection instanceof NodeSelection))
            return;
          const selectedDom = view.nodeDOM(view.state.selection.from);
          if (
            !(selectedDom instanceof Element) ||
            !selectedDom.contains(background)
          )
            return;
          if (
            editor._tiptapEditor.commands.keyboardShortcut(
              event.shiftKey ? "Shift-Tab" : "Tab",
            )
          ) {
            event.preventDefault();
            event.stopPropagation();
            editor.focus();
          }
        },
        { capture: true, signal },
      );
    },
  }),
);
