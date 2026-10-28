import type { NodeViewRendererProps } from "@tiptap/core";
import type { NodeView } from "@tiptap/pm/view";
import { editorColor } from "./colors";

/** Controls are view state, outside contentDOM and clipboard/storage serialization. */
export function blockView({
  node: initial,
  getPos,
  editor,
}: NodeViewRendererProps): NodeView {
  let node = initial;
  let collapsed = false;
  const dom = document.createElement("div");
  dom.dataset.openEditorBlock = "";
  const controls = document.createElement("div");
  controls.dataset.openEditorBlockControls = "";
  controls.contentEditable = "false";
  const check = document.createElement("input");
  check.type = "checkbox";
  check.setAttribute("aria-label", "Checklist item complete");
  const toggle = document.createElement("button");
  toggle.type = "button";
  const contentDOM = document.createElement("div");
  contentDOM.dataset.openEditorContent = "";
  controls.append(check, toggle);
  dom.append(controls, contentDOM);
  const sync = () => {
    dom.dataset.blockId = node.attrs.id;
    const body = node.firstChild;
    dom.dataset.blockType = body?.type.name ?? "";
    dom.style.color = editorColor(body?.attrs.props?.textColor);
    dom.style.backgroundColor = editorColor(
      body?.attrs.props?.backgroundColor,
      true,
    );
    check.hidden = body?.type.name !== "checkListItem";
    check.checked = Boolean(body?.attrs.props?.checked);
    check.disabled = !editor.options.editable;
    toggle.hidden = !(
      body?.type.name === "toggleListItem" ||
      (body?.type.name === "heading" && body.attrs.props?.isToggleable)
    );
    toggle.setAttribute(
      "aria-label",
      collapsed ? "Expand content" : "Collapse content",
    );
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.textContent = collapsed ? "▸" : "▾";
    controls.hidden = check.hidden && toggle.hidden;
    dom.dataset.collapsed = String(!toggle.hidden && collapsed);
  };
  check.addEventListener("change", () => {
    const pos = getPos();
    const body = node.firstChild;
    if (
      !editor.isEditable ||
      pos === undefined ||
      body?.type.name !== "checkListItem"
    ) {
      sync();
      return;
    }
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(pos + 1, undefined, {
        ...body.attrs,
        props: { ...body.attrs.props, checked: check.checked },
      }),
    );
  });
  toggle.addEventListener("click", () => {
    collapsed = !collapsed;
    sync();
  });
  const keyboardToggle = ({
    transaction,
  }: {
    transaction: import("@tiptap/pm/state").Transaction;
  }) => {
    if (
      transaction.getMeta("open-editor-toggle-block") === node.attrs.id &&
      !toggle.hidden
    ) {
      collapsed = !collapsed;
      sync();
    }
  };
  editor.on("transaction", keyboardToggle);
  sync();
  return {
    contentDOM,
    destroy: () => {
      editor.off("transaction", keyboardToggle);
    },
    dom,
    ignoreMutation: (mutation) =>
      mutation.type !== "selection" &&
      (mutation.target === dom || controls.contains(mutation.target)),
    stopEvent: (event) =>
      event.target instanceof globalThis.Node &&
      controls.contains(event.target),
    update(next) {
      if (next.type !== node.type) return false;
      if (next.attrs.id !== node.attrs.id) collapsed = false;
      node = next;
      sync();
      return true;
    },
  };
}
