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
      "button, input, select, textarea, a[href], [role='button'], [role='menuitem'], [contenteditable='false']",
    )
  );
}
